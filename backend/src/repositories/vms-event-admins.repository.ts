import type { D1DatabaseLike } from '../types/bindings'

interface EventAdminRow {
  event_id: string
  membership_number: string
  granted_by: string
  created_at: string
}

export interface EventAdminRecord {
  eventId: string
  membershipNumber: string
  grantedBy: string
  createdAt: string
}

function mapEventAdminRow(row: EventAdminRow): EventAdminRecord {
  return {
    eventId: row.event_id,
    membershipNumber: row.membership_number,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
  }
}

function isMissingEventAdminsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table') && message.includes('event_admins')
}

export async function listEventAdmins(db: D1DatabaseLike, eventId: string): Promise<EventAdminRecord[]> {
  try {
    const result = await db
      .prepare(
        `SELECT event_id, membership_number, granted_by, created_at
         FROM event_admins
         WHERE event_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(eventId)
      .all<EventAdminRow>()

    return result.results.map(mapEventAdminRow)
  } catch (error) {
    if (isMissingEventAdminsTable(error)) {
      return []
    }
    throw error
  }
}

export async function isEventAdmin(db: D1DatabaseLike, eventId: string, membershipNumber: string): Promise<boolean> {
  try {
    const row = await db
      .prepare('SELECT membership_number FROM event_admins WHERE event_id = ? AND membership_number = ? LIMIT 1')
      .bind(eventId, membershipNumber)
      .first<{ membership_number: string }>()

    return Boolean(row)
  } catch (error) {
    if (isMissingEventAdminsTable(error)) {
      return false
    }
    throw error
  }
}

export async function addEventAdmin(
  db: D1DatabaseLike,
  eventId: string,
  membershipNumber: string,
  grantedBy: string,
): Promise<EventAdminRecord> {
  await db
    .prepare(
      `INSERT INTO event_admins (event_id, membership_number, granted_by)
       VALUES (?, ?, ?)`,
    )
    .bind(eventId, membershipNumber, grantedBy)
    .run()

  return {
    eventId,
    membershipNumber,
    grantedBy,
    createdAt: new Date().toISOString(),
  }
}

export async function removeEventAdmin(db: D1DatabaseLike, eventId: string, membershipNumber: string): Promise<boolean> {
  const existing = await db
    .prepare('SELECT membership_number FROM event_admins WHERE event_id = ? AND membership_number = ? LIMIT 1')
    .bind(eventId, membershipNumber)
    .first<{ membership_number: string }>()

  if (!existing) {
    return false
  }

  await db
    .prepare('DELETE FROM event_admins WHERE event_id = ? AND membership_number = ?')
    .bind(eventId, membershipNumber)
    .run()

  return true
}
