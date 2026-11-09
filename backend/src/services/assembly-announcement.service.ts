import {
  countAssemblyAnnouncementFailures,
  countRetryableAnnouncementFailures,
  deleteAssemblyAnnouncementFailure,
  getAssemblyAnnouncementById,
  insertAssemblyAnnouncementFailure,
  listRetryableAnnouncementFailures,
  markAssemblyAnnouncementFailureAttempted,
  startAssemblyAnnouncementRetry,
  updateAssemblyAnnouncementProgress,
  type AssemblyAnnouncementChannel,
  type AssemblyAnnouncementRecord,
} from '../repositories/assembly-announcements.repository'
import { isAppEmailConfigured, sendAppEmail } from './app-email.service'
import {
  countAssemblyEmailRecipients,
  countAssemblyTelegramRecipients,
  listAssemblyEmailRecipientsPage,
  listAssemblyMemberContacts,
  listAssemblyTelegramMembershipNumbersPage,
} from '../repositories/assembly-members.repository'
import { sendBackendTelegramNotification } from './telegram-notification.service'
import type { AppBindings, AssemblyAnnouncementQueueMessage } from '../types/bindings'
import {
  assemblySiteUrl,
  buildAssemblyAnnouncementEmailHtml,
  buildAssemblyAnnouncementEmailText,
  buildAssemblyAnnouncementTelegramText,
} from '../templates/assembly-announcement-email'
import { generateId } from '../utils/id'

const EMAIL_BATCH_SIZE = 10
const TELEGRAM_BATCH_SIZE = 10

interface TelegramNotifyResponse {
  error?: string
  sent_to?: number
  failed_count?: number
  results?: {
    successful?: Array<{ member_id?: string }>
    failed?: Array<{ member_id?: string; error?: string }>
  }
}

function errorMessage(error: unknown, fallback = 'تعذر إرسال أحد رسائل البريد.') {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

export function hasAssemblyAnnouncementQueue(bindings: AppBindings) {
  return Boolean(bindings.ASSEMBLY_ANNOUNCEMENT_QUEUE)
}

export async function enqueueAnnouncementDelivery(bindings: AppBindings, announcementId: string, delaySeconds = 0) {
  if (!bindings.ASSEMBLY_ANNOUNCEMENT_QUEUE) {
    return false
  }

  await bindings.ASSEMBLY_ANNOUNCEMENT_QUEUE.send(
    { announcementId } satisfies AssemblyAnnouncementQueueMessage,
    delaySeconds > 0 ? { delaySeconds } : undefined,
  )
  return true
}

export async function deliverAssemblyAnnouncement(bindings: AppBindings, announcementId: string) {
  const loaded = await getAssemblyAnnouncementById(bindings.VMS_DB, announcementId)
  if (!loaded) {
    return null
  }

  let current = await ensureAnnouncementTotals(bindings, loaded)
  const siteUrl = assemblySiteUrl(bindings.FRONTEND_BASE_URL)

  if (current.retryChannel && current.retryStartedAt) {
    current = (await sendRetryBatch(bindings, current, siteUrl)) ?? current
    if (await announcementHasPendingRetry(bindings, current)) {
      return current
    }

    current =
      (await updateAssemblyAnnouncementProgress(bindings.VMS_DB, current.id, {
        retryChannel: null,
        retryStartedAt: null,
      })) ?? current
    return finalizeAnnouncement(bindings, current)
  }

  if (current.sendTelegram) {
    const telegramTotal = current.telegramTotal || (await countAssemblyTelegramRecipients(bindings.MEMBERS_DB))
    if (current.telegramSent + current.telegramFailed < telegramTotal) {
      current = (await sendTelegramBatch(bindings, current, siteUrl)) ?? current
      return finalizeAnnouncement(bindings, current)
    }
  }

  if (current.sendEmail) {
    current = (await sendEmailBatch(bindings, current, siteUrl)) ?? current
  }

  return finalizeAnnouncement(bindings, current)
}

async function ensureAnnouncementTotals(bindings: AppBindings, announcement: AssemblyAnnouncementRecord) {
  const needsEmailTotal = announcement.sendEmail && announcement.emailTotal <= 0
  const needsTelegramTotal = announcement.sendTelegram && announcement.telegramTotal <= 0
  if (!needsEmailTotal && !needsTelegramTotal) {
    return announcement
  }

  const emailTotal = needsEmailTotal ? await countAssemblyEmailRecipients(bindings.MEMBERS_DB) : announcement.emailTotal
  const telegramTotal = needsTelegramTotal
    ? await countAssemblyTelegramRecipients(bindings.MEMBERS_DB)
    : announcement.telegramTotal

  return (
    (await updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      emailTotal,
      telegramTotal,
    })) ?? { ...announcement, emailTotal, telegramTotal }
  )
}

async function sendTelegramBatch(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const message = buildAssemblyAnnouncementTelegramText({
    subject: announcement.subject,
    body: announcement.body,
    siteUrl,
  })

  const batch = await listAssemblyTelegramMembershipNumbersPage(
    bindings.MEMBERS_DB,
    announcement.telegramSent + announcement.telegramFailed,
    TELEGRAM_BATCH_SIZE,
  )

  if (batch.length === 0) {
    return announcement
  }

  const result = await sendBackendTelegramNotification(bindings, {
    targets: batch,
    message,
  })

  const payload = (result.responseData ?? {}) as TelegramNotifyResponse
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
      for (const membershipNumber of batch) {
        failedItems.push({
          member_id: membershipNumber,
          error: result.error || payload.error || 'تعذر إرسال رسالة تيليغرام.',
        })
      }
    }
  } else {
    for (const membershipNumber of batch) {
      if (successfulIds.has(membershipNumber)) continue
      if (failedItems.some((item) => item.member_id === membershipNumber)) continue
      failedItems.push({ member_id: membershipNumber, error: result.error || 'تعذر إرسال رسالة تيليغرام.' })
    }
  }

  const contacts = await listAssemblyMemberContacts(
    bindings.MEMBERS_DB,
    failedItems.map((item) => item.member_id ?? ''),
  )
  const contactByNumber = new Map(contacts.map((contact) => [contact.membershipNumber, contact]))

  for (const item of failedItems) {
    const membershipNumber = item.member_id?.trim()
    if (!membershipNumber) continue
    const contact = contactByNumber.get(membershipNumber)
    await insertAssemblyAnnouncementFailure(bindings.VMS_DB, {
      id: generateId(),
      announcementId: announcement.id,
      channel: 'telegram',
      membershipNumber,
      email: contact?.email || null,
      displayName: contact?.displayName || membershipNumber,
      error: item.error || 'تعذر إرسال رسالة تيليغرام.',
    })
  }

  const sentDelta =
    successfulIds.size ||
    Number(payload.sent_to ?? (result.success && failedItems.length === 0 ? batch.length : 0))
  const sent = announcement.telegramSent + sentDelta
  const failed = announcement.telegramFailed + failedItems.length

  return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    telegramSent: sent,
    telegramFailed: failed,
    lastError: failedItems[0]?.error || announcement.lastError,
  })
}

async function sendEmailBatch(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const total = announcement.emailTotal || (await countAssemblyEmailRecipients(bindings.MEMBERS_DB))
  if (announcement.emailCursor >= total) {
    return announcement
  }

  const batch = await listAssemblyEmailRecipientsPage(bindings.MEMBERS_DB, announcement.emailCursor, EMAIL_BATCH_SIZE)
  if (batch.length === 0) {
    return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      emailCursor: total,
      emailTotal: total,
    })
  }

  if (!isAppEmailConfigured(bindings)) {
    return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
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
        to: recipient.email,
        subject: `${announcement.subject} — تجمّع إبتكار`,
        text: buildAssemblyAnnouncementEmailText({
          displayName: recipient.displayName,
          subject: announcement.subject,
          body: announcement.body,
          siteUrl,
        }),
        html: buildAssemblyAnnouncementEmailHtml({
          displayName: recipient.displayName,
          subject: announcement.subject,
          body: announcement.body,
          siteUrl,
        }),
      })
      current =
        (await updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
          status: 'sending',
          emailSent: current.emailSent + 1,
          emailCursor: current.emailCursor + 1,
          emailTotal: total,
        })) ?? current
    } catch (error) {
      const message = errorMessage(error)
      await insertAssemblyAnnouncementFailure(bindings.VMS_DB, {
        id: generateId(),
        announcementId: announcement.id,
        channel: 'email',
        membershipNumber: recipient.membershipNumber,
        email: recipient.email,
        displayName: recipient.displayName,
        error: message,
      })
      current =
        (await updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
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

async function finalizeAnnouncement(bindings: AppBindings, announcement: AssemblyAnnouncementRecord) {
  const emailTotal = announcement.sendEmail
    ? announcement.emailTotal || (await countAssemblyEmailRecipients(bindings.MEMBERS_DB))
    : 0
  const telegramTotal = announcement.sendTelegram
    ? announcement.telegramTotal || (await countAssemblyTelegramRecipients(bindings.MEMBERS_DB))
    : 0
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
    (await updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      status: !sentAny ? 'failed' : failed ? 'partial' : 'sent',
      emailTotal,
      telegramTotal,
    })) ?? announcement
  )
}

function originalDeliveryIncomplete(record: AssemblyAnnouncementRecord) {
  if (record.sendTelegram) {
    const telegramTotal = record.telegramTotal
    if (telegramTotal > 0 && record.telegramSent + record.telegramFailed < telegramTotal) {
      return true
    }
  }

  if (record.sendEmail) {
    const emailTotal = record.emailTotal
    if (emailTotal > 0 && record.emailCursor < emailTotal) {
      return true
    }
  }

  return false
}

async function announcementHasPendingRetry(bindings: AppBindings, record: AssemblyAnnouncementRecord) {
  if (!record.retryChannel || !record.retryStartedAt) {
    return false
  }

  const pending = await countRetryableAnnouncementFailures(
    bindings.VMS_DB,
    record.id,
    record.retryChannel,
    record.retryStartedAt,
  )
  return pending > 0
}

export async function startFailedAnnouncementRetry(
  bindings: AppBindings,
  announcementId: string,
  channel: AssemblyAnnouncementChannel,
) {
  const loaded = await getAssemblyAnnouncementById(bindings.VMS_DB, announcementId)
  if (!loaded) {
    return { announcement: null as AssemblyAnnouncementRecord | null, error: 'missing' as const }
  }

  if (loaded.retryChannel && loaded.retryChannel !== channel) {
    return { announcement: loaded, error: 'busy' as const }
  }

  if (!loaded.retryChannel && originalDeliveryIncomplete(loaded)) {
    return { announcement: loaded, error: 'in_progress' as const }
  }

  const failureCount = await countAssemblyAnnouncementFailures(bindings.VMS_DB, loaded.id, channel)
  if (failureCount === 0) {
    return { announcement: loaded, error: 'none' as const }
  }

  const started =
    loaded.retryChannel === channel && loaded.retryStartedAt
      ? loaded
      : ((await startAssemblyAnnouncementRetry(bindings.VMS_DB, loaded.id, channel)) ?? loaded)

  return { announcement: started, error: null }
}

async function sendRetryBatch(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  if (!announcement.retryChannel || !announcement.retryStartedAt) {
    return announcement
  }

  if (announcement.retryChannel === 'telegram') {
    return sendRetryTelegramBatch(bindings, announcement, siteUrl)
  }

  return sendRetryEmailBatch(bindings, announcement, siteUrl)
}

async function syncChannelFailureCount(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  channel: AssemblyAnnouncementChannel,
  extra: { emailSent?: number; telegramSent?: number; lastError?: string | null },
) {
  const failed = await countAssemblyAnnouncementFailures(bindings.VMS_DB, announcement.id, channel)
  return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    ...(channel === 'email' ? { emailFailed: failed } : { telegramFailed: failed }),
    ...extra,
  })
}

async function sendRetryTelegramBatch(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const retryStartedAt = announcement.retryStartedAt
  if (!retryStartedAt) {
    return announcement
  }

  const pending = await listRetryableAnnouncementFailures(
    bindings.VMS_DB,
    announcement.id,
    'telegram',
    retryStartedAt,
    TELEGRAM_BATCH_SIZE,
  )
  if (pending.length === 0) {
    return announcement
  }

  const message = buildAssemblyAnnouncementTelegramText({
    subject: announcement.subject,
    body: announcement.body,
    siteUrl,
  })

  const withoutNumber: typeof pending = []
  const withNumber: typeof pending = []
  for (const item of pending) {
    if (item.membershipNumber?.trim()) {
      withNumber.push(item)
    } else {
      withoutNumber.push(item)
    }
  }

  for (const item of withoutNumber) {
    await markAssemblyAnnouncementFailureAttempted(
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
    const result = await sendBackendTelegramNotification(bindings, {
      targets: batch,
      message,
    })
    const payload = (result.responseData ?? {}) as TelegramNotifyResponse
    const successfulIds = new Set(
      (payload.results?.successful ?? [])
        .map((item) => item.member_id?.trim())
        .filter((value): value is string => Boolean(value)),
    )
    const failedByNumber = new Map(
      (payload.results?.failed ?? [])
        .filter((item) => item.member_id?.trim())
        .map((item) => [item.member_id!.trim(), item.error || 'تعذر إرسال رسالة تيليغرام.']),
    )

    if (successfulIds.size === 0 && failedByNumber.size === 0 && !result.success && (result.status ?? 500) >= 500) {
      throw new Error(result.error || 'تعذر إرسال رسالة تيليغرام مؤقتاً.')
    }

    const treatBatchAsSuccessful =
      result.success &&
      successfulIds.size === 0 &&
      failedByNumber.size === 0 &&
      (payload.sent_to === undefined || Number(payload.sent_to) === batch.length)

    for (const item of withNumber) {
      const membershipNumber = item.membershipNumber!.trim()
      if (successfulIds.has(membershipNumber) || treatBatchAsSuccessful) {
        await deleteAssemblyAnnouncementFailure(bindings.VMS_DB, item.id)
        sentDelta += 1
        continue
      }

      const error =
        failedByNumber.get(membershipNumber) ||
        result.error ||
        payload.error ||
        item.error ||
        'تعذر إرسال رسالة تيليغرام.'
      lastError = error
      await markAssemblyAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, error)
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
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const retryStartedAt = announcement.retryStartedAt
  if (!retryStartedAt) {
    return announcement
  }

  const pending = await listRetryableAnnouncementFailures(
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
      await markAssemblyAnnouncementFailureAttempted(
        bindings.VMS_DB,
        item.id,
        retryStartedAt,
        'إعداد البريد غير مكتمل.',
      )
    }
    return (
      (await syncChannelFailureCount(bindings, announcement, 'email', {
        lastError: 'إعداد البريد غير مكتمل.',
      })) ?? announcement
    )
  }

  const contacts = await listAssemblyMemberContacts(
    bindings.MEMBERS_DB,
    pending.map((item) => item.membershipNumber ?? ''),
  )
  const contactByNumber = new Map(contacts.map((contact) => [contact.membershipNumber, contact]))

  let current = announcement
  let sentDelta = 0
  let lastError = announcement.lastError

  for (const item of pending) {
    const contact = item.membershipNumber ? contactByNumber.get(item.membershipNumber) : undefined
    const email = item.email?.trim() || contact?.email || ''
    const displayName = item.displayName || contact?.displayName || item.membershipNumber || email

    if (!email) {
      lastError = 'لا يوجد بريد لإعادة الإرسال.'
      await markAssemblyAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, lastError)
      continue
    }

    try {
      await sendAppEmail(bindings, {
        to: email,
        subject: `${announcement.subject} — تجمّع إبتكار`,
        text: buildAssemblyAnnouncementEmailText({
          displayName,
          subject: announcement.subject,
          body: announcement.body,
          siteUrl,
        }),
        html: buildAssemblyAnnouncementEmailHtml({
          displayName,
          subject: announcement.subject,
          body: announcement.body,
          siteUrl,
        }),
      })
      await deleteAssemblyAnnouncementFailure(bindings.VMS_DB, item.id)
      sentDelta += 1
    } catch (error) {
      lastError = errorMessage(error)
      await markAssemblyAnnouncementFailureAttempted(bindings.VMS_DB, item.id, retryStartedAt, lastError)
    }
  }

  current =
    (await syncChannelFailureCount(bindings, announcement, 'email', {
      emailSent: announcement.emailSent + sentDelta,
      lastError,
    })) ?? current

  return current
}

export async function announcementNeedsContinue(bindings: AppBindings, record: AssemblyAnnouncementRecord) {
  if (await announcementHasPendingRetry(bindings, record)) {
    return true
  }

  if (record.status === 'failed' || record.status === 'sent' || record.status === 'partial') {
    return false
  }

  if (record.sendTelegram) {
    const telegramTotal = record.telegramTotal || (await countAssemblyTelegramRecipients(bindings.MEMBERS_DB))
    if (record.telegramSent + record.telegramFailed < telegramTotal) {
      return true
    }
  }

  if (record.sendEmail) {
    const emailTotal = record.emailTotal || (await countAssemblyEmailRecipients(bindings.MEMBERS_DB))
    if (record.emailCursor < emailTotal) {
      return true
    }
  }

  return false
}

export { EMAIL_BATCH_SIZE }
