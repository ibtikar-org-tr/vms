import { WorkerMailer } from 'worker-mailer'
import {
  getAssemblyAnnouncementById,
  insertAssemblyAnnouncementFailure,
  updateAssemblyAnnouncementProgress,
  type AssemblyAnnouncementRecord,
} from '../repositories/assembly-announcements.repository'
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

const EMAIL_BATCH_SIZE = 3
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

  if (!bindings.SMTP_HOST || !bindings.SMTP_USER || !bindings.SMTP_PASS) {
    return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      status: 'failed',
      lastError: 'إعداد البريد غير مكتمل.',
      emailCursor: total,
      emailFailed: announcement.emailFailed + (total - announcement.emailCursor),
    })
  }

  const smtpPort = Number.parseInt(String(bindings.SMTP_PORT ?? '587'), 10)
  let mailer: Awaited<ReturnType<typeof WorkerMailer.connect>> | null = null
  let current = announcement

  try {
    mailer = await WorkerMailer.connect({
      host: bindings.SMTP_HOST,
      port: smtpPort,
      secure: false,
      startTls: true,
      credentials: {
        username: bindings.SMTP_USER,
        password: bindings.SMTP_PASS,
      },
      authType: 'plain',
    })
  } catch (error) {
    throw new Error(errorMessage(error, 'تعذر الاتصال بخادم البريد.'))
  }

  try {
    for (const recipient of batch) {
      try {
        await mailer.send({
          from: bindings.SMTP_USER,
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
  } finally {
    if (mailer) {
      try {
        await mailer.close()
      } catch {
        // WorkerMailer can throw while tearing down a broken SMTP socket.
      }
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

export async function announcementNeedsContinue(bindings: AppBindings, record: AssemblyAnnouncementRecord) {
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
