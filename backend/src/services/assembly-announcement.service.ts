import { WorkerMailer } from 'worker-mailer'
import {
  getAssemblyAnnouncementById,
  updateAssemblyAnnouncementProgress,
  type AssemblyAnnouncementRecord,
} from '../repositories/assembly-announcements.repository'
import {
  listAssemblyEmailRecipients,
  listAssemblyTelegramMembershipNumbers,
} from '../repositories/assembly-members.repository'
import { sendBackendTelegramNotification } from './telegram-notification.service'
import type { AppBindings } from '../types/bindings'
import {
  assemblySiteUrl,
  buildAssemblyAnnouncementEmailHtml,
  buildAssemblyAnnouncementEmailText,
  buildAssemblyAnnouncementTelegramText,
} from '../templates/assembly-announcement-email'

const EMAIL_BATCH_SIZE = 12
const TELEGRAM_BATCH_SIZE = 25

export async function deliverAssemblyAnnouncement(
  bindings: AppBindings,
  announcementId: string,
  options?: { emailOnly?: boolean },
) {
  const announcement = await getAssemblyAnnouncementById(bindings.VMS_DB, announcementId)
  if (!announcement) {
    return null
  }

  let current = announcement
  const siteUrl = assemblySiteUrl(bindings.FRONTEND_BASE_URL)

  if (!options?.emailOnly && current.sendTelegram && current.status === 'queued') {
    current = (await sendTelegramBatches(bindings, current, siteUrl)) ?? current
  }

  if (current.sendEmail) {
    current = (await sendEmailBatch(bindings, current, siteUrl)) ?? current
  }

  return finalizeAnnouncement(bindings, current)
}

async function sendTelegramBatches(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const membershipNumbers = await listAssemblyTelegramMembershipNumbers(bindings.MEMBERS_DB)
  const message = buildAssemblyAnnouncementTelegramText({
    subject: announcement.subject,
    body: announcement.body,
    siteUrl,
  })

  let sent = 0
  let failed = 0

  for (let index = 0; index < membershipNumbers.length; index += TELEGRAM_BATCH_SIZE) {
    const batch = membershipNumbers.slice(index, index + TELEGRAM_BATCH_SIZE)
    const result = await sendBackendTelegramNotification(bindings, {
      targets: batch,
      message,
    })

    if (result.success) {
      const response = result.responseData as { sent_to?: number; failed_count?: number } | undefined
      sent += Number(response?.sent_to ?? batch.length)
      failed += Number(response?.failed_count ?? 0)
    } else {
      failed += batch.length
    }
  }

  return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    telegramSent: sent,
    telegramFailed: failed,
    lastError: failed > 0 && sent === 0 ? 'تعذر إرسال رسالة تيليغرام.' : announcement.lastError,
  })
}

async function sendEmailBatch(
  bindings: AppBindings,
  announcement: AssemblyAnnouncementRecord,
  siteUrl: string,
) {
  const recipients = await listAssemblyEmailRecipients(bindings.MEMBERS_DB)
  const remaining = recipients.slice(announcement.emailCursor)
  if (remaining.length === 0) {
    return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      emailCursor: recipients.length,
    })
  }

  const batch = remaining.slice(0, EMAIL_BATCH_SIZE)
  let sent = announcement.emailSent
  let failed = announcement.emailFailed
  let lastError = announcement.lastError

  if (!bindings.SMTP_HOST || !bindings.SMTP_USER || !bindings.SMTP_PASS) {
    return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
      status: 'failed',
      lastError: 'إعداد البريد غير مكتمل.',
      emailCursor: recipients.length,
      emailFailed: failed + remaining.length,
    })
  }

  const smtpPort = Number.parseInt(String(bindings.SMTP_PORT ?? '587'), 10)
  let mailer: Awaited<ReturnType<typeof WorkerMailer.connect>> | null = null

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
        sent += 1
      } catch (error) {
        failed += 1
        lastError = error instanceof Error ? error.message : 'تعذر إرسال أحد رسائل البريد.'
      }
    }
  } catch (error) {
    failed += batch.length
    lastError = error instanceof Error ? error.message : 'تعذر الاتصال بخادم البريد.'
  } finally {
    if (mailer) {
      await mailer.close().catch(() => {})
    }
  }

  return updateAssemblyAnnouncementProgress(bindings.VMS_DB, announcement.id, {
    status: 'sending',
    emailSent: sent,
    emailFailed: failed,
    emailCursor: announcement.emailCursor + batch.length,
    lastError,
  })
}

async function finalizeAnnouncement(bindings: AppBindings, announcement: AssemblyAnnouncementRecord) {
  const recipients = announcement.sendEmail ? await listAssemblyEmailRecipients(bindings.MEMBERS_DB) : []
  const emailDone = !announcement.sendEmail || announcement.emailCursor >= recipients.length
  if (!emailDone) {
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
    })) ?? announcement
  )
}

export async function announcementNeedsContinue(bindings: AppBindings, record: AssemblyAnnouncementRecord) {
  if (!record.sendEmail || record.status === 'failed' || record.status === 'sent' || record.status === 'partial') {
    return false
  }

  const recipients = await listAssemblyEmailRecipients(bindings.MEMBERS_DB)
  return record.emailCursor < recipients.length
}

export { EMAIL_BATCH_SIZE }
