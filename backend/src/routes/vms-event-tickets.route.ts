import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  createEventTicket,
  deleteEventTicketById,
  getEventTicketById,
  listEventTickets,
  updateEventTicketById,
} from '../repositories/vms-event-tickets.repository'
import { getEventById } from '../repositories/vms-events.repository'
import { createEventTicketSchema, eventTicketParamsSchema, updateEventTicketSchema } from '../schemas/vms-event-ticket.schema'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { canManageEvent } from '../utils/event-permissions'
import { stripTicketActiveRegistrationCounts } from '../utils/event-registration-counts'
import { jsonValidationHook } from '../utils/zod-json-error'

export const vmsEventTicketsRoute = new Hono<AppEnv>()

async function presentEventTickets(
  db: AppEnv['Bindings']['VMS_DB'],
  eventId: string,
  membershipNumber: string,
) {
  const [event, eventTickets] = await Promise.all([getEventById(db, eventId), listEventTickets(db, eventId)])

  if (!event) {
    return { event: null, eventTickets }
  }

  if (event.displayAttendeeNumbers === false) {
    const canManage = await canManageEvent(db, event, membershipNumber)
    if (!canManage) {
      return { event, eventTickets: stripTicketActiveRegistrationCounts(eventTickets) }
    }
  }

  return { event, eventTickets }
}

vmsEventTicketsRoute.get('/event-tickets', async (c) => {
  try {
    const eventId = c.req.query('eventId')?.trim()
    const membershipNumber = getActorMembershipNumber(c)

    if (eventId) {
      const { eventTickets } = await presentEventTickets(c.env.VMS_DB, eventId, membershipNumber)
      return c.json({ eventTickets })
    }

    const eventTickets = await listEventTickets(c.env.VMS_DB)
    return c.json({ eventTickets: stripTicketActiveRegistrationCounts(eventTickets) })
  } catch (error) {
    console.error('Failed to list event tickets', error)
    return c.json({ error: 'Could not fetch event tickets.' }, 500)
  }
})

vmsEventTicketsRoute.get('/event-tickets/:id', zValidator('param', eventTicketParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const eventTicket = await getEventTicketById(c.env.VMS_DB, id)

    if (!eventTicket) {
      return c.json({ error: 'Event ticket not found.' }, 404)
    }

    const event = await getEventById(c.env.VMS_DB, eventTicket.eventId)
    if (event?.displayAttendeeNumbers === false) {
      const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
      if (!canManage) {
        const [ticketWithoutCount] = stripTicketActiveRegistrationCounts([eventTicket])
        return c.json({ eventTicket: ticketWithoutCount })
      }
    }

    return c.json({ eventTicket })
  } catch (error) {
    console.error('Failed to fetch event ticket', error)
    return c.json({ error: 'Could not fetch event ticket.' }, 500)
  }
})

vmsEventTicketsRoute.post(
  '/event-tickets',
  zValidator('json', createEventTicketSchema, jsonValidationHook),
  async (c) => {
    try {
      const payload = c.req.valid('json')
      const event = await getEventById(c.env.VMS_DB, payload.eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
      if (!canManage) {
        return c.json({ error: 'Only the project owner or managers can create event tickets.' }, 403)
      }

      const eventTicketId = crypto.randomUUID()
      const eventTicket = await createEventTicket(c.env.VMS_DB, eventTicketId, payload)

      return c.json({ eventTicket }, 201)
    } catch (error) {
      console.error('Failed to create event ticket', error)
      return c.json({ error: 'Could not create event ticket.' }, 500)
    }
  },
)

vmsEventTicketsRoute.put(
  '/event-tickets/:id',
  zValidator('param', eventTicketParamsSchema),
  zValidator('json', updateEventTicketSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const payload = c.req.valid('json')

      const existing = await getEventTicketById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'Event ticket not found.' }, 404)
      }

      const event = await getEventById(c.env.VMS_DB, existing.eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
      if (!canManage) {
        return c.json({ error: 'Only the project owner or managers can update event tickets.' }, 403)
      }

      if (payload.quantity !== undefined && payload.quantity < existing.activeRegistrationCount) {
        return c.json(
          {
            error: `لا يمكن تقليل المقاعد إلى ${payload.quantity} لأن ${existing.activeRegistrationCount} مسجّلاً حالياً على هذه التذكرة.`,
          },
          409,
        )
      }

      const eventTicket = await updateEventTicketById(c.env.VMS_DB, id, payload)
      if (!eventTicket) {
        return c.json({ error: 'Event ticket not found.' }, 404)
      }

      return c.json({ eventTicket })
    } catch (error) {
      console.error('Failed to update event ticket', error)
      return c.json({ error: 'Could not update event ticket.' }, 500)
    }
  },
)

vmsEventTicketsRoute.delete('/event-tickets/:id', zValidator('param', eventTicketParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const existing = await getEventTicketById(c.env.VMS_DB, id)

    if (!existing) {
      return c.json({ error: 'Event ticket not found.' }, 404)
    }

    const event = await getEventById(c.env.VMS_DB, existing.eventId)
    if (event) {
      const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
      if (!canManage) {
        return c.json({ error: 'Only the project owner or managers can delete event tickets.' }, 403)
      }
    }

    const deleted = await deleteEventTicketById(c.env.VMS_DB, id)

    if (!deleted) {
      return c.json({ error: 'Event ticket not found.' }, 404)
    }

    return c.json({ message: 'Event ticket deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete event ticket', error)
    return c.json({ error: 'Could not delete event ticket.' }, 500)
  }
})
