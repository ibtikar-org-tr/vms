import type { D1DatabaseLike } from '../types/bindings'

export type AssemblyAnnouncementStatus = 'queued' | 'sending' | 'sent' | 'partial' | 'failed'

export interface AssemblyAnnouncementRecord {
  id: string
  createdAt: string
  updatedAt: string
  createdBy: string
  subject: string
  body: string
  sendEmail: boolean
  sendTelegram: boolean
  status: AssemblyAnnouncementStatus
  emailSent: number
  emailFailed: number
  emailCursor: number
  telegramSent: number
  telegramFailed: number
  lastError: string | null
}

interface AnnouncementRow {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  subject: string
  body: string
  send_email: number
  send_telegram: number
  status: string
  email_sent: number
  email_failed: number
  email_cursor: number
  telegram_sent: number
  telegram_failed: number
  last_error: string | null
}

function mapAnnouncement(row: AnnouncementRow): AssemblyAnnouncementRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    subject: row.subject,
    body: row.body,
    sendEmail: row.send_email === 1,
    sendTelegram: row.send_telegram === 1,
    status: row.status as AssemblyAnnouncementStatus,
    emailSent: row.email_sent,
    emailFailed: row.email_failed,
    emailCursor: row.email_cursor,
    telegramSent: row.telegram_sent,
    telegramFailed: row.telegram_failed,
    lastError: row.last_error,
  }
}

export async function createAssemblyAnnouncement(
  db: D1DatabaseLike,
  input: {
    id: string
    createdBy: string
    subject: string
    body: string
    sendEmail: boolean
    sendTelegram: boolean
  },
) {
  await db
    .prepare(
      `INSERT INTO assembly_announcements (
         id, created_by, subject, body, send_email, send_telegram, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.createdBy,
      input.subject,
      input.body,
      input.sendEmail ? 1 : 0,
      input.sendTelegram ? 1 : 0,
      'queued',
    )
    .run()

  return getAssemblyAnnouncementById(db, input.id)
}

export async function getAssemblyAnnouncementById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare('SELECT * FROM assembly_announcements WHERE id = ?')
    .bind(id)
    .first<AnnouncementRow>()

  return row ? mapAnnouncement(row) : null
}

export async function listAssemblyAnnouncements(db: D1DatabaseLike, limit = 20) {
  const result = await db
    .prepare(
      `SELECT * FROM assembly_announcements
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(Math.max(1, Math.min(limit, 50)))
    .all<AnnouncementRow>()

  return result.results.map(mapAnnouncement)
}

export async function updateAssemblyAnnouncementProgress(
  db: D1DatabaseLike,
  id: string,
  patch: Partial<{
    status: AssemblyAnnouncementStatus
    emailSent: number
    emailFailed: number
    emailCursor: number
    telegramSent: number
    telegramFailed: number
    lastError: string | null
  }>,
) {
  const updates: string[] = []
  const values: unknown[] = []

  if (patch.status !== undefined) {
    updates.push('status = ?')
    values.push(patch.status)
  }
  if (patch.emailSent !== undefined) {
    updates.push('email_sent = ?')
    values.push(patch.emailSent)
  }
  if (patch.emailFailed !== undefined) {
    updates.push('email_failed = ?')
    values.push(patch.emailFailed)
  }
  if (patch.emailCursor !== undefined) {
    updates.push('email_cursor = ?')
    values.push(patch.emailCursor)
  }
  if (patch.telegramSent !== undefined) {
    updates.push('telegram_sent = ?')
    values.push(patch.telegramSent)
  }
  if (patch.telegramFailed !== undefined) {
    updates.push('telegram_failed = ?')
    values.push(patch.telegramFailed)
  }
  if (patch.lastError !== undefined) {
    updates.push('last_error = ?')
    values.push(patch.lastError)
  }

  if (updates.length === 0) {
    return getAssemblyAnnouncementById(db, id)
  }

  await db
    .prepare(`UPDATE assembly_announcements SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run()

  return getAssemblyAnnouncementById(db, id)
}

export function isMissingAnnouncementsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /no such table: assembly_announcements/i.test(message)
}
