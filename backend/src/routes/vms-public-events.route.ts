import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getUserByEmail } from '../repositories/users.repository'
import {
  listEventRegistrationsByEventAndGuestEmail,
} from '../repositories/vms-event-registrations.repository'
import { listEventTickets } from '../repositories/vms-event-tickets.repository'
import { getEventById } from '../repositories/vms-events.repository'
import { createGuestEventRegistrationSchema } from '../schemas/vms-event-registration.schema'
import { eventParamsSchema } from '../schemas/vms-event.schema'
import {
  isEventRegistrationUniqueConflict,
  registerSelectedEventTickets,
} from '../services/event-ticket-registration.service'
import type { AppBindings } from '../types/bindings'
import { uniqueTicketIds, validateRequestedTicketIds } from '../utils/event-ticket-ids'
import { stripTicketActiveRegistrationCounts } from '../utils/event-registration-counts'

export const vmsPublicEventsRoute = new Hono<{ Bindings: AppBindings }>()

vmsPublicEventsRoute.get('/public/events/:id', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const event = await getEventById(c.env.VMS_DB, id)

    if (!event || event.status !== 'public') {
      return c.json({ error: 'Event not found.' }, 404)
    }

    return c.json({ event })
  } catch (error) {
    console.error('Failed to fetch public event', error)
    return c.json({ error: 'Could not fetch event.' }, 500)
  }
})

vmsPublicEventsRoute.get('/public/events/:id/tickets', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const event = await getEventById(c.env.VMS_DB, id)

    if (!event || event.status !== 'public') {
      return c.json({ error: 'Event not found.' }, 404)
    }

    const eventTickets = await listEventTickets(c.env.VMS_DB, id)
    const visibleTickets =
      event.displayAttendeeNumbers === false
        ? stripTicketActiveRegistrationCounts(eventTickets)
        : eventTickets

    return c.json({ eventTickets: visibleTickets })
  } catch (error) {
    console.error('Failed to fetch public event tickets', error)
    return c.json({ error: 'Could not fetch event tickets.' }, 500)
  }
})

vmsPublicEventsRoute.post(
  '/public/events/:id/registrations',
  zValidator('param', eventParamsSchema),
  zValidator('json', createGuestEventRegistrationSchema),
  async (c) => {
    try {
      const { id: eventId } = c.req.valid('param')
      const payload = c.req.valid('json')

      const event = await getEventById(c.env.VMS_DB, eventId)
      if (!event || event.status !== 'public') {
        return c.json({ error: 'Event not found.' }, 404)
      }

      if (!event.allowGuestRegistration) {
        return c.json({ error: 'التسجيل في هذه الفعالية متاح للأعضاء فقط. يرجى تسجيل الدخول.' }, 403)
      }

      const existingUser = await getUserByEmail(c.env.MEMBERS_DB, payload.guestEmail)
      if (existingUser) {
        return c.json({ error: 'هذا البريد مرتبط بحساب. يرجى تسجيل الدخول للتقديم.' }, 409)
      }

      const ticketIds = uniqueTicketIds(payload)
      const ticketIdsError = validateRequestedTicketIds(ticketIds)
      if (ticketIdsError) {
        return c.json({ error: ticketIdsError }, 400)
      }

      const existingGuestRegistrations = await listEventRegistrationsByEventAndGuestEmail(
        c.env.VMS_DB,
        eventId,
        payload.guestEmail,
      )

      const result = await registerSelectedEventTickets(c.env.VMS_DB, {
        eventId,
        ticketIds,
        ownedTicketIds: existingGuestRegistrations
          .filter((registration) => registration.status === 'registered' || registration.status === 'attended')
          .map((registration) => registration.ticketId),
        membershipNumber: null,
        guestEmail: payload.guestEmail,
        guestName: payload.guestName,
        guestPhone: payload.guestPhone,
      })

      if (!result.ok) {
        return c.json({ error: result.error }, result.status)
      }

      const eventRegistrations = result.created.map((eventRegistration) => ({
        ...eventRegistration,
        displayName: eventRegistration.guestName ?? payload.guestName,
      }))

      return c.json(
        {
          eventRegistration: eventRegistrations[0],
          eventRegistrations,
        },
        201,
      )
    } catch (error) {
      if (isEventRegistrationUniqueConflict(error)) {
        return c.json({ error: 'هذا البريد مسجّل مسبقاً على إحدى هذه التذاكر.' }, 409)
      }

      console.error('Failed to create guest event registration', error)
      return c.json({ error: 'Could not create event registration.' }, 500)
    }
  },
)
