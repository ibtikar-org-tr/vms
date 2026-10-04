import type { UpdateEventRegistrationInput } from '../schemas/vms-event-registration.schema'
import type { D1DatabaseLike } from '../types/bindings'
import {
  applyRegistrationCountTransition,
  isActiveEventRegistrationStatus,
} from '../utils/event-registration-counts'
import { listEventTickets } from './vms-event-tickets.repository'

interface EventRegistrationRow {
  id: string
  created_at: string
  updated_at: string
  event_id: string
  membership_number: string | null
  ticket_id: string
  status: string
  payment_approved_by: string | null
  attendance_approved_by: string | null
  guest_email: string | null
  guest_name: string | null
  guest_phone: string | null
}

export interface CreateEventRegistrationRecord {
  eventId: string
  membershipNumber?: string | null
  ticketId: string
  status: string
  attendanceApprovedBy?: string | null
  guestEmail?: string | null
  guestName?: string | null
  guestPhone?: string | null
}

function mapEventRegistrationRow(row: EventRegistrationRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventId: row.event_id,
    membershipNumber: row.membership_number,
    ticketId: row.ticket_id,
    status: row.status,
    paymentApprovedBy: row.payment_approved_by,
    attendanceApprovedBy: row.attendance_approved_by,
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
  }
}

export interface ListEventRegistrationsOptions {
  eventId?: string
  membershipNumber?: string
  guestEmail?: string
  ticketId?: string
  limit?: number
  offset?: number
}

const EVENT_REGISTRATION_SELECT =
  'SELECT id, created_at, updated_at, event_id, membership_number, ticket_id, status, payment_approved_by, attendance_approved_by, guest_email, guest_name, guest_phone FROM event_registrations'

function normalizeGuestEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isEventRegistrationUniqueConflict(error: unknown) {
  if (!(error instanceof Error) || !error.message.includes('UNIQUE constraint failed')) {
    return false
  }

  return (
    error.message.includes('event_registrations') ||
    error.message.includes('idx_event_registrations_event_member_ticket') ||
    error.message.includes('idx_event_registrations_event_guest_email_ticket')
  )
}

export async function countEventRegistrations(
  db: D1DatabaseLike,
  options: Pick<ListEventRegistrationsOptions, 'eventId' | 'membershipNumber'> = {},
) {
  const conditions: string[] = []
  const values: unknown[] = []

  if (options.eventId) {
    conditions.push('event_id = ?')
    values.push(options.eventId)
  }

  if (options.membershipNumber) {
    conditions.push('membership_number = ?')
    values.push(options.membershipNumber)
  }

  if (options.guestEmail) {
    conditions.push('guest_email = ?')
    values.push(normalizeGuestEmail(options.guestEmail))
  }

  if (options.ticketId) {
    conditions.push('ticket_id = ?')
    values.push(options.ticketId)
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  const row = await db
    .prepare(`SELECT COUNT(*) as count FROM event_registrations${whereClause}`)
    .bind(...values)
    .first<{ count: number }>()

  return row?.count ?? 0
}

export async function countActiveEventRegistrationsByTicket(db: D1DatabaseLike, eventId: string) {
  const tickets = await listEventTickets(db, eventId)
  const ticketCounts = new Map<string, number>()
  let total = 0

  for (const ticket of tickets) {
    ticketCounts.set(ticket.id, ticket.activeRegistrationCount)
    total += ticket.activeRegistrationCount
  }

  return { ticketCounts, total }
}

export async function listEventRegistrations(db: D1DatabaseLike, options: ListEventRegistrationsOptions = {}) {
  const conditions: string[] = []
  const values: unknown[] = []

  if (options.eventId) {
    conditions.push('event_id = ?')
    values.push(options.eventId)
  }

  if (options.membershipNumber) {
    conditions.push('membership_number = ?')
    values.push(options.membershipNumber)
  }

  if (options.guestEmail) {
    conditions.push('guest_email = ?')
    values.push(normalizeGuestEmail(options.guestEmail))
  }

  if (options.ticketId) {
    conditions.push('ticket_id = ?')
    values.push(options.ticketId)
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  let query = `${EVENT_REGISTRATION_SELECT}${whereClause} ORDER BY created_at DESC`

  if (options.limit !== undefined) {
    query += ' LIMIT ?'
    values.push(options.limit)
  }

  if (options.offset !== undefined) {
    query += ' OFFSET ?'
    values.push(options.offset)
  }

  const result = await db.prepare(query).bind(...values).all<EventRegistrationRow>()
  return result.results.map(mapEventRegistrationRow)
}

export async function getEventRegistrationById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare(`${EVENT_REGISTRATION_SELECT} WHERE id = ?`)
    .bind(id)
    .first<EventRegistrationRow>()

  return row ? mapEventRegistrationRow(row) : null
}

export async function getEventRegistrationByEventAndMember(
  db: D1DatabaseLike,
  eventId: string,
  membershipNumber: string,
) {
  const row = await db
    .prepare(
      `${EVENT_REGISTRATION_SELECT} WHERE event_id = ? AND membership_number = ? AND status IN ('registered', 'attended') ORDER BY created_at DESC`,
    )
    .bind(eventId, membershipNumber)
    .first<EventRegistrationRow>()

  return row ? mapEventRegistrationRow(row) : null
}

export async function getEventRegistrationByEventAndGuestEmail(
  db: D1DatabaseLike,
  eventId: string,
  guestEmail: string,
) {
  const row = await db
    .prepare(`${EVENT_REGISTRATION_SELECT} WHERE event_id = ? AND guest_email = ?`)
    .bind(eventId, normalizeGuestEmail(guestEmail))
    .first<EventRegistrationRow>()

  return row ? mapEventRegistrationRow(row) : null
}

export async function getEventRegistrationByEventMemberAndTicket(
  db: D1DatabaseLike,
  eventId: string,
  membershipNumber: string,
  ticketId: string,
) {
  const row = await db
    .prepare(`${EVENT_REGISTRATION_SELECT} WHERE event_id = ? AND membership_number = ? AND ticket_id = ?`)
    .bind(eventId, membershipNumber, ticketId)
    .first<EventRegistrationRow>()

  return row ? mapEventRegistrationRow(row) : null
}

export async function listEventRegistrationsByEventAndGuestEmail(
  db: D1DatabaseLike,
  eventId: string,
  guestEmail: string,
) {
  return listEventRegistrations(db, { eventId, guestEmail })
}

export async function createEventRegistration(
  db: D1DatabaseLike,
  id: string,
  input: CreateEventRegistrationRecord,
) {
  await db
    .prepare(
      'INSERT INTO event_registrations (id, event_id, membership_number, ticket_id, status, attendance_approved_by, guest_email, guest_name, guest_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      input.eventId,
      input.membershipNumber ?? null,
      input.ticketId,
      input.status,
      input.attendanceApprovedBy ?? null,
      'guestEmail' in input && input.guestEmail ? normalizeGuestEmail(input.guestEmail) : null,
      'guestName' in input && input.guestName ? input.guestName.trim() : null,
      'guestPhone' in input && input.guestPhone ? input.guestPhone.trim() : null,
    )
    .run()

  await applyRegistrationCountTransition(db, null, {
    ticketId: input.ticketId,
    status: input.status,
  })

  const created = await getEventRegistrationById(db, id)
  if (!created) {
    throw new Error('Failed to load created event registration.')
  }

  return created
}

export async function claimGuestEventRegistrations(
  db: D1DatabaseLike,
  membershipNumber: string,
  email: string,
) {
  const normalizedEmail = normalizeGuestEmail(email)
  const result = await db
    .prepare(`${EVENT_REGISTRATION_SELECT} WHERE guest_email = ? AND membership_number IS NULL`)
    .bind(normalizedEmail)
    .all<EventRegistrationRow>()

  let claimed = 0

  for (const row of result.results) {
    const existingMemberRegistration = await getEventRegistrationByEventMemberAndTicket(
      db,
      row.event_id,
      membershipNumber,
      row.ticket_id,
    )
    if (existingMemberRegistration && isActiveEventRegistrationStatus(existingMemberRegistration.status)) {
      continue
    }

    try {
      await db
        .prepare(
          `UPDATE event_registrations
           SET membership_number = ?, updated_at = datetime('now')
           WHERE id = ? AND membership_number IS NULL`,
        )
        .bind(membershipNumber, row.id)
        .run()
      claimed += 1
    } catch (error) {
      if (isEventRegistrationUniqueConflict(error)) {
        continue
      }
      throw error
    }
  }

  return claimed
}

export async function updateEventRegistrationById(db: D1DatabaseLike, id: string, input: UpdateEventRegistrationInput) {
  const existing = await getEventRegistrationById(db, id)

  if (!existing) {
    return null
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (input.eventId !== undefined) {
    updates.push('event_id = ?')
    values.push(input.eventId)
  }

  if (input.membershipNumber !== undefined) {
    updates.push('membership_number = ?')
    values.push(input.membershipNumber)
  }

  if (input.ticketId !== undefined) {
    updates.push('ticket_id = ?')
    values.push(input.ticketId)
  }

  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }

  if (input.paymentApprovedBy !== undefined) {
    updates.push('payment_approved_by = ?')
    values.push(input.paymentApprovedBy)
  }

  if (input.attendanceApprovedBy !== undefined) {
    updates.push('attendance_approved_by = ?')
    values.push(input.attendanceApprovedBy)
  }

  if (updates.length === 0) {
    return existing
  }

  updates.push("updated_at = datetime('now')")

  await db
    .prepare(`UPDATE event_registrations SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run()

  const updated = await getEventRegistrationById(db, id)
  if (!updated) {
    return null
  }

  const countStateChanged = input.ticketId !== undefined || input.status !== undefined
  if (countStateChanged) {
    await applyRegistrationCountTransition(
      db,
      { ticketId: existing.ticketId, status: existing.status },
      { ticketId: updated.ticketId, status: updated.status },
    )
  }

  return updated
}

export async function deleteEventRegistrationById(db: D1DatabaseLike, id: string) {
  const existing = await getEventRegistrationById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM event_registrations WHERE id = ?').bind(id).run()

  await applyRegistrationCountTransition(
    db,
    { ticketId: existing.ticketId, status: existing.status },
    null,
  )

  return true
}
