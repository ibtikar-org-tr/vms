import type { D1DatabaseLike } from '../types/bindings'

export type AssemblyAnnouncementStatus = 'queued' | 'sending' | 'sent' | 'partial' | 'failed'
export type AssemblyAnnouncementChannel = 'email' | 'telegram'

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
  emailTotal: number
  telegramTotal: number
  lastError: string | null
}

export interface AssemblyAnnouncementFailureRecord {
  id: string
  createdAt: string
  announcementId: string
  channel: AssemblyAnnouncementChannel
  membershipNumber: string | null
  email: string | null
  displayName: string | null
  error: string | null
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
  email_total?: number | null
  telegram_total?: number | null
  last_error: string | null
}

interface FailureRow {
  id: string
  created_at: string
  announcement_id: string
  channel: string
  membership_number: string | null
  email: string | null
  display_name: string | null
  error: string | null
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
    emailTotal: Number(row.email_total ?? 0),
    telegramTotal: Number(row.telegram_total ?? 0),
    lastError: row.last_error,
  }
}

function mapFailure(row: FailureRow): AssemblyAnnouncementFailureRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    announcementId: row.announcement_id,
    channel: row.channel === 'telegram' ? 'telegram' : 'email',
    membershipNumber: row.membership_number,
    email: row.email,
    displayName: row.display_name,
    error: row.error,
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
    emailTotal: number
    telegramTotal: number
  },
) {
  await db
    .prepare(
      `INSERT INTO assembly_announcements (
         id, created_by, subject, body, send_email, send_telegram, status, email_total, telegram_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.createdBy,
      input.subject,
      input.body,
      input.sendEmail ? 1 : 0,
      input.sendTelegram ? 1 : 0,
      'queued',
      input.emailTotal,
      input.telegramTotal,
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
    emailTotal: number
    telegramTotal: number
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
  if (patch.emailTotal !== undefined) {
    updates.push('email_total = ?')
    values.push(patch.emailTotal)
  }
  if (patch.telegramTotal !== undefined) {
    updates.push('telegram_total = ?')
    values.push(patch.telegramTotal)
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

export async function insertAssemblyAnnouncementFailure(
  db: D1DatabaseLike,
  input: {
    id: string
    announcementId: string
    channel: AssemblyAnnouncementChannel
    membershipNumber?: string | null
    email?: string | null
    displayName?: string | null
    error?: string | null
  },
) {
  await db
    .prepare(
      `INSERT INTO assembly_announcement_failures (
         id, announcement_id, channel, membership_number, email, display_name, error
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.announcementId,
      input.channel,
      input.membershipNumber ?? null,
      input.email ?? null,
      input.displayName ?? null,
      input.error ?? null,
    )
    .run()
}

export async function listAssemblyAnnouncementFailures(db: D1DatabaseLike, announcementId: string) {
  const result = await db
    .prepare(
      `SELECT * FROM assembly_announcement_failures
       WHERE announcement_id = ?
       ORDER BY created_at ASC`,
    )
    .bind(announcementId)
    .all<FailureRow>()

  return result.results.map(mapFailure)
}

export function isMissingAnnouncementsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /no such table: assembly_announcements/i.test(message)
}

export function isMissingAnnouncementFailuresTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /no such table: assembly_announcement_failures|no such column: email_total/i.test(message)
}
