import {
  createEventRegistration,
  deleteEventRegistrationById,
  isEventRegistrationUniqueConflict,
  type CreateEventRegistrationRecord,
} from '../repositories/vms-event-registrations.repository'
import { getEventTicketById } from '../repositories/vms-event-tickets.repository'
import type { D1DatabaseLike } from '../types/bindings'

export type EventRegistrationRecord = Awaited<ReturnType<typeof createEventRegistration>>
export { isEventRegistrationUniqueConflict }

export async function registerSelectedEventTickets(
  db: D1DatabaseLike,
  input: {
    eventId: string
    ticketIds: string[]
    ownedTicketIds: Iterable<string>
    membershipNumber?: string | null
    guestEmail?: string | null
    guestName?: string | null
    guestPhone?: string | null
    allowMultipleTickets?: boolean
  },
): Promise<
  | { ok: true; created: EventRegistrationRecord[] }
  | { ok: false; status: 400 | 409; error: string }
> {
  const owned = new Set(input.ownedTicketIds)
  const requestedTicketIds = [...new Set(input.ticketIds)].filter((ticketId) => !owned.has(ticketId))
  const allowMultipleTickets = input.allowMultipleTickets === true

  if (!allowMultipleTickets && owned.size > 0) {
    return { ok: false, status: 409, error: 'يمكنك اختيار تذكرة واحدة فقط لهذه الفعالية.' }
  }

  if (requestedTicketIds.length === 0) {
    return { ok: false, status: 409, error: 'أنت مسجّل بالفعل على التذاكر المختارة.' }
  }

  if (!allowMultipleTickets && requestedTicketIds.length > 1) {
    return { ok: false, status: 400, error: 'يرجى اختيار تذكرة واحدة فقط.' }
  }

  for (const ticketId of requestedTicketIds) {
    const ticket = await getEventTicketById(db, ticketId)
    if (!ticket || ticket.eventId !== input.eventId) {
      return { ok: false, status: 400, error: 'التذكرة المختارة غير متاحة لهذه الفعالية.' }
    }

    if (ticket.activeRegistrationCount + 1 > ticket.quantity) {
      return { ok: false, status: 409, error: `لم يعد هناك مقاعد متاحة لتذكرة «${ticket.name}».` }
    }
  }

  const created: EventRegistrationRecord[] = []

  try {
    for (const ticketId of requestedTicketIds) {
      const record: CreateEventRegistrationRecord = {
        eventId: input.eventId,
        membershipNumber: input.membershipNumber ?? null,
        ticketId,
        status: 'registered',
        guestEmail: input.guestEmail ?? null,
        guestName: input.guestName ?? null,
        guestPhone: input.guestPhone ?? null,
      }
      created.push(await createEventRegistration(db, crypto.randomUUID(), record))
    }
  } catch (error) {
    for (const registration of created) {
      await deleteEventRegistrationById(db, registration.id)
    }
    throw error
  }

  return { ok: true, created }
}
