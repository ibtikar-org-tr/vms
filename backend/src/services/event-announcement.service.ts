import {
  countEventAnnouncementFailures,
  countRetryableEventAnnouncementFailures,
  deleteEventAnnouncementFailure,
  getEventAnnouncementById,
  insertEventAnnouncementFailure,
  listRetryableEventAnnouncementFailures,
  markEventAnnouncementFailureAttempted,
  startEventAnnouncementRetry,
  updateEventAnnouncementProgress,
  type EventAnnouncementChannel,
  type EventAnnouncementRecord,
} from '../repositories/event-announcements.repository'
import {
  eventAnnouncementAudience,
  eventAnnouncementEmailRecipients,
  eventAnnouncementTelegramRecipients,
  listEventAnnouncementPeople,
  type EventAnnouncementPerson,
} from '../repositories/event-announcement-recipients.repository'
import { getEventById } from '../repositories/vms-events.repository'
import { isAppEmailConfigured, sendAppEmail } from './app-email.service'
import { sendBackendTelegramNotification } from './telegram-notification.service'
import { describeTelegramFailure, telegramNotifyPayload } from './assembly-announcement.service'
import type { AppBindings } from '../types/bindings'
import {
  buildEventAnnouncementEmailHtml,
  buildEventAnnouncementEmailText,
  buildEventAnnouncementTelegramText,
  eventPageUrl,
} from '../templates/event-announcement-email'
import { generateId } from '../utils/id'

const EMAIL_BATCH_SIZE = 10
const TELEGRAM_BATCH_SIZE = 10

function errorMessage(error: unknown, fallback = 'تعذر إرسال أحد رسائل البريد.') {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

export async function enqueueEventAnnouncementDelivery(bindings: AppBindings, announcementId: string, delaySeconds = 0) {
  if (!bindings.ASSEMBLY_ANNOUNCEMENT_QUEUE) {
    return false
  }

  await bindings.ASSEMBLY_ANNOUNCEMENT_QUEUE.send(
    { announcementId, kind: 'event' },
    delaySeconds > 0 ? { delaySeconds } : undefined,
  )
  return true
}

export async function loadEventAnnouncementAudience(bindings: AppBindings, eventId: string) {
  const people = await listEventAnnouncementPeople(bindings.VMS_DB, bindings.MEMBERS_DB, eventId)
  return { people, audience: eventAnnouncementAudience(people) }
}

async function eventNameFor(bindings: AppBindings, eventId: string) {
  const event = await getEventById(bindings.VMS_DB, eventId)
  return event?.name?.trim() || 'فعالية تجمّع إبتكار'
}

export async function deliverEventAnnouncement(bindings: AppBindings, announcementId: string) {
  const loaded = await getEventAnnouncementById(bindings.VMS_DB, announcementId)
  if (!loaded) {
    return null
  }

  const eventUrl = eventPageUrl(bindings.FRONTEND_BASE_URL, loaded.eventId)
  const eventName = await eventNameFor(bindings, loaded.eventId)
  const people = await listEventAnnouncementPeople(bindings.VMS_DB, bindings.MEMBERS_DB, loaded.eventId)
  let current = await ensureEventAnnouncementTotals(bindings, loaded, people)

  if (current.retryChannel && current.retryStartedAt) {
    current = (await sendRetryBatch(bindings, current, eventName, eventUrl, people)) ?? current
    if (await announcementHasPendingRetry(bindings, current)) {
      return current
    }

    current =
      (await updateEventAnnouncementProgress(bindings.VMS_DB, current.id, {
        retryChannel: null,
        retryStartedAt: null,
      })) ?? current
    return finalizeAnnouncement(bindings, current, people)
  }

  if (current.sendTelegram) {
    const telegramTotal = current.telegramTotal || eventAnnouncementTelegramRecipients(people).length
    if (current.telegramSent + current.telegramFailed < telegramTotal) {
      current = (await sendTelegramBatch(bindings, current, eventName, eventUrl, people)) ?? current
      return finalizeAnnouncement(bindings, current, people)
    }
  }

  if (current.sendEmail) {
    current = (await sendEmailBatch(bindings, current, eventName, eventUrl, people)) ?? current
  }

  return finalizeAnnouncement(bindings, current, people)
}

async function ensureEventAnnouncementTotals(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  people: EventAnnouncementPerson[],
) {
  const needsEmailTotal = announcement.sendEmail && announcement.emailTotal <= 0
  const needsTelegramTotal = announcement.sendTelegram && announcement.telegramTotal <= 0
  if (!needsEmailTotal && !needsTelegramTotal) {
    return announcement
  }

  const audience = eventAnnouncementAudience(people)
  return (
    (await updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      emailTotal: needsEmailTotal ? audience.email : announcement.emailTotal,
      telegramTotal: needsTelegramTotal ? audience.telegram : announcement.telegramTotal,
    })) ?? {
      ...announcement,
      emailTotal: needsEmailTotal ? audience.email : announcement.emailTotal,
      telegramTotal: needsTelegramTotal ? audience.telegram : announcement.telegramTotal,
    }
  )
}

async function sendTelegramBatch(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  eventName: string,
  eventUrl: string,
  people: EventAnnouncementPerson[],
) {
  const recipients = eventAnnouncementTelegramRecipients(people)
  const offset = announcement.telegramSent + announcement.telegramFailed
  const batch = recipients.slice(offset, offset + TELEGRAM_BATCH_SIZE)
  if (batch.length === 0) {
    return announcement
  }

  const result = await sendBackendTelegramNotification(bindings, {
    targets: batch.map((person) => person.membershipNumber!),
    message: buildEventAnnouncementTelegramText({
      eventName,
      subject: announcement.subject,
      body: announcement.body,
      eventUrl,
    }),
  })

  const payload = telegramNotifyPayload(result)
  const successfulIds = new Set(
    (payload.results?.successful ?? [])
      .map((item) => item.member_id?.trim())
      .filter((value): value is string => Boolean(value)),
  )
  const failedItems =
    payload.results?.failed?.filter((item) => Boolean(item.member_id?.trim())) ?? []

  if (successfulIds.size === 0 && failedItems.length === 0) {
    if (!result.success && (result.status ?? 500) >= 500) {
      throw new Error(result.error || 'تعذر إرسال رسالة تيليغرام مؤقتاً.')
    }
    if (!result.success) {
      for (const person of batch) {
        failedItems.push({
          member_id: person.membershipNumber ?? '',
          error: result.error || payload.error || 'تعذر إرسال رسالة تيليغرام.',
        })
      }
    }
  } else {
    for (const person of batch) {
      const membershipNumber = person.membershipNumber ?? ''
      if (successfulIds.has(membershipNumber)) continue
      if (failedItems.some((item) => item.member_id === membershipNumber)) continue
      failedItems.push({ member_id: membershipNumber, error: result.error || 'تعذر إرسال رسالة تيليغرام.' })
    }
  }

  const peopleByNumber = new Map(batch.map((person) => [person.membershipNumber, person]))
  for (const item of failedItems) {
    const membershipNumber = item.member_id?.trim()
    if (!membershipNumber) continue
    const person = peopleByNumber.get(membershipNumber)
    await insertEventAnnouncementFailure(bindings.VMS_DB, {
      id: generateId(),
      announcementId: announcement.id,
      channel: 'telegram',
      membershipNumber,
      email: person?.email || null,
      displayName: person?.displayName || membershipNumber,
      error: describeTelegramFailure(item.error),
    })
  }

  const sentDelta =
    successfulIds.size ||
    Number(payload.sent_to ?? (result.success && failedItems.length === 0 ? batch.length : 0))

  return updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    telegramSent: announcement.telegramSent + sentDelta,
    telegramFailed: announcement.telegramFailed + failedItems.length,
    lastError: describeTelegramFailure(failedItems[0]?.error) || announcement.lastError,
  })
}

async function sendEmailBatch(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  eventName: string,
  eventUrl: string,
  people: EventAnnouncementPerson[],
) {
  const recipients = eventAnnouncementEmailRecipients(people)
  const total = announcement.emailTotal || recipients.length
  if (announcement.emailCursor >= total) {
    return announcement
  }

  const batch = recipients.slice(announcement.emailCursor, announcement.emailCursor + EMAIL_BATCH_SIZE)
  if (batch.length === 0) {
    return updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      emailCursor: total,
      emailTotal: total,
    })
  }

  if (!isAppEmailConfigured(bindings)) {
    return updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      status: 'failed',
      lastError: 'إعداد البريد غير مكتمل.',
      emailCursor: total,
      emailFailed: announcement.emailFailed + (total - announcement.emailCursor),
    })
  }

  let current = announcement
  for (const recipient of batch) {
    try {
      await sendAppEmail(bindings, {
        to: recipient.email!,
        subject: `${announcement.subject} — ${eventName}`,
        text: buildEventAnnouncementEmailText({
          displayName: recipient.displayName,
          eventName,
          subject: announcement.subject,
          body: announcement.body,
          eventUrl,
        }),
        html: buildEventAnnouncementEmailHtml({
          displayName: recipient.displayName,
          eventName,
          subject: announcement.subject,
          body: announcement.body,
          eventUrl,
        }),
      })
      current =
        (await updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
          status: 'sending',
          emailSent: current.emailSent + 1,
          emailCursor: current.emailCursor + 1,
          emailTotal: total,
        })) ?? current
    } catch (error) {
      const message = errorMessage(error)
      await insertEventAnnouncementFailure(bindings.VMS_DB, {
        id: generateId(),
        announcementId: announcement.id,
        channel: 'email',
        membershipNumber: recipient.membershipNumber,
        email: recipient.email,
        displayName: recipient.displayName,
        error: message,
      })
      current =
        (await updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
          status: 'sending',
          emailFailed: current.emailFailed + 1,
          emailCursor: current.emailCursor + 1,
          emailTotal: total,
          lastError: message,
        })) ?? current
    }
  }

  return current
}

async function finalizeAnnouncement(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  people: EventAnnouncementPerson[],
) {
  const audience = eventAnnouncementAudience(people)
  const emailTotal = announcement.sendEmail ? announcement.emailTotal || audience.email : 0
  const telegramTotal = announcement.sendTelegram ? announcement.telegramTotal || audience.telegram : 0
  const emailDone = !announcement.sendEmail || announcement.emailCursor >= emailTotal
  const telegramDone =
    !announcement.sendTelegram || announcement.telegramSent + announcement.telegramFailed >= telegramTotal

  if (!emailDone || !telegramDone) {
    return announcement
  }

  const failed =
    (announcement.sendEmail && announcement.emailFailed > 0) ||
    (announcement.sendTelegram && announcement.telegramFailed > 0)
  const sentAny =
    (announcement.sendEmail && announcement.emailSent > 0) ||
    (announcement.sendTelegram && announcement.telegramSent > 0)

  return (
    (await updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      status: !sentAny ? 'failed' : failed ? 'partial' : 'sent',
      emailTotal,
      telegramTotal,
    })) ?? announcement
  )
}

function originalDeliveryIncomplete(record: EventAnnouncementRecord) {
  if (record.sendTelegram && record.telegramTotal > 0 && record.telegramSent + record.telegramFailed < record.telegramTotal) {
    return true
  }
  if (record.sendEmail && record.emailTotal > 0 && record.emailCursor < record.emailTotal) {
    return true
  }
  return false
}

async function announcementHasPendingRetry(bindings: AppBindings, record: EventAnnouncementRecord) {
  if (!record.retryChannel || !record.retryStartedAt) {
    return false
  }
  const pending = await countRetryableEventAnnouncementFailures(
    bindings.VMS_DB,
    record.id,
    record.retryChannel,
    record.retryStartedAt,
  )
  return pending > 0
}

export async function eventAnnouncementNeedsContinue(bindings: AppBindings, announcement: EventAnnouncementRecord) {
  if (await announcementHasPendingRetry(bindings, announcement)) {
    return true
  }
  return originalDeliveryIncomplete(announcement)
}

export async function startFailedEventAnnouncementRetry(
  bindings: AppBindings,
  announcementId: string,
  channel: EventAnnouncementChannel,
) {
  const loaded = await getEventAnnouncementById(bindings.VMS_DB, announcementId)
  if (!loaded) {
    return { announcement: null as EventAnnouncementRecord | null, error: 'missing' as const }
  }
  if (loaded.retryChannel && loaded.retryChannel !== channel) {
    return { announcement: loaded, error: 'busy' as const }
  }
  if (!loaded.retryChannel && originalDeliveryIncomplete(loaded)) {
    return { announcement: loaded, error: 'in_progress' as const }
  }
  const failureCount = await countEventAnnouncementFailures(bindings.VMS_DB, loaded.id, channel)
  if (failureCount === 0) {
    return { announcement: loaded, error: 'none' as const }
  }
  const started =
    loaded.retryChannel === channel && loaded.retryStartedAt
      ? loaded
      : ((await startEventAnnouncementRetry(bindings.VMS_DB, loaded.id, channel)) ?? loaded)
  return { announcement: started, error: null }
}

async function sendRetryBatch(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  eventName: string,
  eventUrl: string,
  people: EventAnnouncementPerson[],
) {
  if (!announcement.retryChannel || !announcement.retryStartedAt) {
    return announcement
  }
  if (announcement.retryChannel === 'telegram') {
    return sendRetryTelegramBatch(bindings, announcement, eventName, eventUrl)
  }
  return sendRetryEmailBatch(bindings, announcement, eventName, eventUrl, people)
}

async function syncChannelFailureCount(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  channel: EventAnnouncementChannel,
  extra: { emailSent?: number; telegramSent?: number; lastError?: string | null },
) {
  const failed = await countEventAnnouncementFailures(bindings.VMS_DB, announcement.id, channel)
  return updateEventAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    ...(channel === 'email' ? { emailFailed: failed } : { telegramFailed: failed }),
    ...extra,
  })
}

async function sendRetryTelegramBatch(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  eventName: string,
  eventUrl: string,
) {
  const retryStartedAt = announcement.retryStartedAt
  if (!retryStartedAt) {
    return announcement
  }

  const pending = await listRetryableEventAnnouncementFailures(
    bindings.VMS_DB,
    announcement.id,
    'telegram',
    retryStartedAt,
    TELEGRAM_BATCH_SIZE,
  )
  if (pending.length === 0) {
    return announcement
  }

  const message = buildEventAnnouncementTelegramText({
    eventName,
    subject: announcement.subject,
    body: announcement.body,
    eventUrl,
  })
  const withoutNumber = pending.filter((item) => !item.membershipNumber?.trim())
  const withNumber = pending.filter((item) => item.membershipNumber?.trim())

  for (const item of withoutNumber) {
    await markEventAnnouncementFailureAttempted(
      bindings.VMS_DB,
      item.id,
      retryStartedAt,
      item.error || 'لا يوجد رقم عضوية لإعادة إرسال تيليغرام.',
    )
  }

  let sentDelta = 0
  let lastError = announcement.lastError

  if (withNumber.length > 0) {
    const batch = withNumber.map((item) => item.membershipNumber!.trim())
    const result = await sendBackendTelegramNotification(bindings, { targets: batch, message })
    const payload = telegramNotifyPayload(result)
    const successfulIds = new Set(
      (payload.results?.successful ?? [])
        .map((item) => item.member_id?.trim())
        .filter((value): value is string => Boolean(value)),
    )
    const failedByNumber = new Map(
      (payload.results?.failed ?? [])
        .filter((item) => item.member_id?.trim())
        .map((item) => [item.member_id!.trim(), describeTelegramFailure(item.error)]),
    )

    if (successfulIds.size === 0 && failedByNumber.size === 0 && !result.success && (result.status ?? 500) >= 500) {
      throw new Error(result.error || 'تعذر إرسال رسالة تيليغرام مؤقتاً.')
    }

    const treatBatchAsSuccessful =
      result.success && successfulIds.size === 0 && failedByNumber.size === 0 && Number(payload.sent_to) === batch.length

    for (const item of withNumber) {
      const membershipNumber = item.membershipNumber!.trim()
      if (successfulIds.has(membershipNumber) || treatBatchAsSuccessful) {
        await deleteEventAnnouncementFailure(bindings.VMS_DB, item.id)
        sentDelta += 1
        continue
      }
      const error = describeTelegramFailure(
        failedByNumber.get(membershipNumber) || result.error || payload.error || item.error,
      )
      lastError = error
      await markEventAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, error)
    }
  }

  return (
    (await syncChannelFailureCount(bindings, announcement, 'telegram', {
      telegramSent: announcement.telegramSent + sentDelta,
      lastError,
    })) ?? announcement
  )
}

async function sendRetryEmailBatch(
  bindings: AppBindings,
  announcement: EventAnnouncementRecord,
  eventName: string,
  eventUrl: string,
  people: EventAnnouncementPerson[],
) {
  const retryStartedAt = announcement.retryStartedAt
  if (!retryStartedAt) {
    return announcement
  }

  const pending = await listRetryableEventAnnouncementFailures(
    bindings.VMS_DB,
    announcement.id,
    'email',
    retryStartedAt,
    EMAIL_BATCH_SIZE,
  )
  if (pending.length === 0) {
    return announcement
  }

  if (!isAppEmailConfigured(bindings)) {
    for (const item of pending) {
      await markEventAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, 'إعداد البريد غير مكتمل.')
    }
    return (
      (await syncChannelFailureCount(bindings, announcement, 'email', {
        lastError: 'إعداد البريد غير مكتمل.',
      })) ?? announcement
    )
  }

  const peopleByEmail = new Map(
    people.filter((person) => person.email).map((person) => [person.email!, person]),
  )
  let sentDelta = 0
  let lastError = announcement.lastError

  for (const item of pending) {
    const email = item.email?.trim().toLowerCase()
    if (!email) {
      await markEventAnnouncementFailureAttempted(
        bindings.VMS_DB,
        item.id,
        retryStartedAt,
        item.error || 'لا يوجد بريد لإعادة الإرسال.',
      )
      continue
    }

    const person = peopleByEmail.get(email)
    try {
      await sendAppEmail(bindings, {
        to: email,
        subject: `${announcement.subject} — ${eventName}`,
        text: buildEventAnnouncementEmailText({
          displayName: item.displayName || person?.displayName || 'مسجّل',
          eventName,
          subject: announcement.subject,
          body: announcement.body,
          eventUrl,
        }),
        html: buildEventAnnouncementEmailHtml({
          displayName: item.displayName || person?.displayName || 'مسجّل',
          eventName,
          subject: announcement.subject,
          body: announcement.body,
          eventUrl,
        }),
      })
      await deleteEventAnnouncementFailure(bindings.VMS_DB, item.id)
      sentDelta += 1
    } catch (error) {
      const message = errorMessage(error)
      lastError = message
      await markEventAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, message)
    }
  }

  return (
    (await syncChannelFailureCount(bindings, announcement, 'email', {
      emailSent: announcement.emailSent + sentDelta,
      lastError,
    })) ?? announcement
  )
}
