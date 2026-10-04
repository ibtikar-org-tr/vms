import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  deleteEventRegistrationById,
  getEventRegistrationById,
  getEventRegistrationByEventAndMember,
  getEventRegistrationByEventMemberAndTicket,
  claimGuestEventRegistrations,
  countActiveEventRegistrationsByTicket,
  countEventRegistrations,
  listEventRegistrations,
  updateEventRegistrationById,
} from '../repositories/vms-event-registrations.repository'
import { getMemberContactInfoByMembershipNumber } from '../repositories/user-info.repository'
import { getEventTicketById } from '../repositories/vms-event-tickets.repository'
import { getEventById, getEventCancellationSettingsById } from '../repositories/vms-events.repository'
import { getUserDisplayNamesByMembershipNumbers } from '../repositories/user-info.repository'
import {
  createEventRegistrationSchema,
  changeEventRegistrationTicketSchema,
  eventRegistrationParamsSchema,
  eventRegistrationCountsParamsSchema,
  eventRegistrantContactParamsSchema,
  updateEventRegistrationSchema,
} from '../schemas/vms-event-registration.schema'
import {
  isEventRegistrationUniqueConflict,
  registerSelectedEventTickets,
} from '../services/event-ticket-registration.service'
import type { AppBindings } from '../types/bindings'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber, getActorUser } from '../utils/actor'
import { canManageEvent } from '../utils/event-permissions'
import {
  canSelfCancelRegistration,
  canSelfModifyRegistration,
} from '../utils/event-registration-cancellation'
import { uniqueTicketIds, validateRequestedTicketIds } from '../utils/event-ticket-ids'

export const vmsEventRegistrationsRoute = new Hono<AppEnv>()

const DEFAULT_EVENT_REGISTRATIONS_PAGE_SIZE = 50
const MAX_EVENT_REGISTRATIONS_PAGE_SIZE = 200

function parseEventRegistrationsPagination(c: { req: { query: (key: string) => string | undefined } }) {
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const eventId = c.req.query('eventId')
  const membershipNumberFilter = c.req.query('membershipNumber')

  let limit: number | undefined
  if (limitParam === '0') {
    limit = undefined
  } else if (limitParam !== undefined) {
    const parsedLimit = Number.parseInt(limitParam, 10)
    limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_EVENT_REGISTRATIONS_PAGE_SIZE)
      : DEFAULT_EVENT_REGISTRATIONS_PAGE_SIZE
  } else if (eventId && !membershipNumberFilter) {
    limit = DEFAULT_EVENT_REGISTRATIONS_PAGE_SIZE
  }

  const offset = offsetParam ? Math.max(Number.parseInt(offsetParam, 10) || 0, 0) : 0

  return { limit, offset }
}

async function enrichEventRegistrationsWithDisplayNames<
  T extends {
    membershipNumber: string | null
    guestName?: string | null
    guestEmail?: string | null
  },
>(membersDb: AppBindings['MEMBERS_DB'], eventRegistrations: T[]) {
  const displayNameMap = await getUserDisplayNamesByMembershipNumbers(
    membersDb,
    eventRegistrations
      .map((registration) => registration.membershipNumber)
      .filter((membershipNumber): membershipNumber is string => Boolean(membershipNumber)),
  )

  return eventRegistrations.map((registration) => {
    const memberName = registration.membershipNumber
      ? displayNameMap.get(registration.membershipNumber)
      : undefined

    return {
      ...registration,
      displayName:
        memberName ||
        registration.guestName?.trim() ||
        registration.membershipNumber ||
        registration.guestEmail ||
        'زائر',
    }
  })
}

function withRedactedGuestContact<
  T extends {
    guestEmail?: string | null
    guestPhone?: string | null
  },
>(registration: T, canViewGuestContact: boolean) {
  if (canViewGuestContact) {
    return registration
  }

  return {
    ...registration,
    guestEmail: null,
    guestPhone: null,
  }
}

vmsEventRegistrationsRoute.get(
  '/events/:eventId/registration-counts',
  zValidator('param', eventRegistrationCountsParamsSchema),
  async (c) => {
    try {
      const { eventId } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)

      const event = await getEventById(c.env.VMS_DB, eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      if (event.displayAttendeeNumbers === false) {
        const canManage = await canManageEvent(c.env.VMS_DB, event, actorMembershipNumber)
        if (!canManage) {
          return c.json({ ticketCounts: {}, total: 0 })
        }
      }

      const { ticketCounts, total } = await countActiveEventRegistrationsByTicket(c.env.VMS_DB, eventId)

      return c.json({
        ticketCounts: Object.fromEntries(ticketCounts),
        total,
      })
    } catch (error) {
      console.error('Failed to fetch event registration counts', error)
      return c.json({ error: 'Could not fetch event registration counts.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.get(
  '/events/:eventId/registrants/:membershipNumber/contact',
  zValidator('param', eventRegistrantContactParamsSchema),
  async (c) => {
    try {
      const { eventId, membershipNumber } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)

      const event = await getEventById(c.env.VMS_DB, eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const canManage = await canManageEvent(c.env.VMS_DB, event, actorMembershipNumber)
      if (!canManage) {
        return c.json({ error: 'Only the project owner or managers can view registrant contact info.' }, 403)
      }

      const registration = await getEventRegistrationByEventAndMember(c.env.VMS_DB, eventId, membershipNumber)
      if (!registration) {
        return c.json({ error: 'Event registrant not found.' }, 404)
      }

      const contact = await getMemberContactInfoByMembershipNumber(c.env.MEMBERS_DB, membershipNumber)
      if (!contact) {
        return c.json({ error: 'Member contact info not found.' }, 404)
      }

      return c.json({ contact })
    } catch (error) {
      console.error('Failed to fetch event registrant contact info', error)
      return c.json({ error: 'Could not fetch event registrant contact info.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.get('/event-registrations', async (c) => {
  try {
    const eventId = c.req.query('eventId')
    const membershipNumberFilter = c.req.query('membershipNumber')
    const { limit, offset } = parseEventRegistrationsPagination(c)
    const actorMembershipNumber = getActorMembershipNumber(c)

    let restrictedMembershipNumber = membershipNumberFilter
    let canViewGuestContact = false

    if (eventId) {
      const event = await getEventById(c.env.VMS_DB, eventId)
      canViewGuestContact = event
        ? await canManageEvent(c.env.VMS_DB, event, actorMembershipNumber)
        : false

      if (event && event.displayAttendeeNumbers === false && !membershipNumberFilter && !canViewGuestContact) {
        restrictedMembershipNumber = actorMembershipNumber ?? undefined
      }
    }

    const listOptions = {
      eventId,
      membershipNumber: restrictedMembershipNumber,
      limit,
      offset: limit !== undefined ? offset : undefined,
    }

    const eventRegistrations = await listEventRegistrations(c.env.VMS_DB, listOptions)

    const enrichedRegistrations = listOptions.membershipNumber
      ? eventRegistrations
      : await enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, eventRegistrations)

    const visibleRegistrations = enrichedRegistrations.map((registration) =>
      withRedactedGuestContact(registration, canViewGuestContact),
    )

    if (eventId && limit !== undefined) {
      const total = await countEventRegistrations(c.env.VMS_DB, {
        eventId,
        membershipNumber: restrictedMembershipNumber,
      })

      return c.json({
        eventRegistrations: visibleRegistrations,
        total,
        hasMore: offset + visibleRegistrations.length < total,
      })
    }

    return c.json({ eventRegistrations: visibleRegistrations })
  } catch (error) {
    console.error('Failed to list event registrations', error)
    return c.json({ error: 'Could not fetch event registrations.' }, 500)
  }
})

vmsEventRegistrationsRoute.get(
  '/event-registrations/:id',
  zValidator('param', eventRegistrationParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const eventRegistration = await getEventRegistrationById(c.env.VMS_DB, id)

      if (!eventRegistration) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      const [enrichedRegistration] = await enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, [
        eventRegistration,
      ])

      const event = await getEventById(c.env.VMS_DB, eventRegistration.eventId)
      const canViewGuestContact = event
        ? await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
        : false

      return c.json({
        eventRegistration: withRedactedGuestContact(enrichedRegistration, canViewGuestContact),
      })
    } catch (error) {
      console.error('Failed to fetch event registration', error)
      return c.json({ error: 'Could not fetch event registration.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.post('/event-registrations', zValidator('json', createEventRegistrationSchema), async (c) => {
  try {
    const payload = c.req.valid('json')
    const actorMembershipNumber = getActorMembershipNumber(c)

    if (payload.membershipNumber !== actorMembershipNumber) {
      return c.json({ error: 'يمكنك التسجيل في الفعالية لحسابك فقط.' }, 403)
    }

    const event = await getEventById(c.env.VMS_DB, payload.eventId)
    if (!event) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    if (event.status !== 'public') {
      return c.json({ error: 'التسجيل متاح فقط للفعاليات المنشورة.' }, 403)
    }

    const ticketIds = uniqueTicketIds(payload)
    const ticketIdsError = validateRequestedTicketIds(ticketIds)
    if (ticketIdsError) {
      return c.json({ error: ticketIdsError }, 400)
    }

    try {
      await claimGuestEventRegistrations(c.env.VMS_DB, actorMembershipNumber, getActorUser(c).email)
    } catch (error) {
      console.error('Failed to claim guest event registrations before member apply', error)
    }

    const existingRegistrations = await listEventRegistrations(c.env.VMS_DB, {
      eventId: payload.eventId,
      membershipNumber: actorMembershipNumber,
    })

    const result = await registerSelectedEventTickets(c.env.VMS_DB, {
      eventId: payload.eventId,
      ticketIds,
      ownedTicketIds: existingRegistrations
        .filter((registration) => registration.status === 'registered' || registration.status === 'attended')
        .map((registration) => registration.ticketId),
      membershipNumber: actorMembershipNumber,
    })

    if (!result.ok) {
      return c.json({ error: result.error }, result.status)
    }

    const [enrichedRegistrations] = await Promise.all([
      enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, result.created),
    ])

    return c.json(
      {
        eventRegistration: enrichedRegistrations[0],
        eventRegistrations: enrichedRegistrations,
      },
      201,
    )
  } catch (error) {
    if (isEventRegistrationUniqueConflict(error)) {
      return c.json({ error: 'لديك تسجيل سابق على إحدى هذه التذاكر.' }, 409)
    }

    console.error('Failed to create event registration', error)
    return c.json({ error: 'Could not create event registration.' }, 500)
  }
})

vmsEventRegistrationsRoute.put(
  '/event-registrations/:id',
  zValidator('param', eventRegistrationParamsSchema),
  zValidator('json', updateEventRegistrationSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const payload = c.req.valid('json')
      const actorMembershipNumber = getActorMembershipNumber(c)

      const existing = await getEventRegistrationById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      const event = await getEventById(c.env.VMS_DB, existing.eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const canManage = await canManageEvent(c.env.VMS_DB, event, actorMembershipNumber)
      if (!canManage) {
        return c.json({ error: 'Only event managers can update registrations.' }, 403)
      }

      const eventRegistration = await updateEventRegistrationById(c.env.VMS_DB, id, payload)
      const [enrichedRegistration] = await enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, [
        eventRegistration!,
      ])
      return c.json({ eventRegistration: enrichedRegistration })
    } catch (error) {
      console.error('Failed to update event registration', error)
      return c.json({ error: 'Could not update event registration.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.post(
  '/event-registrations/:id/self-cancel',
  zValidator('param', eventRegistrationParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)

      const registration = await getEventRegistrationById(c.env.VMS_DB, id)
      if (!registration) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      const event = await getEventCancellationSettingsById(c.env.VMS_DB, registration.eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const authorization = canSelfCancelRegistration(event, registration, actorMembershipNumber)
      if (!authorization.allowed) {
        return c.json({ error: authorization.reason }, 403)
      }

      const deleted = await deleteEventRegistrationById(c.env.VMS_DB, id)
      if (!deleted) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      return c.json({ message: 'تم إلغاء التسجيل بنجاح.' })
    } catch (error) {
      console.error('Failed to self-cancel event registration', error)
      return c.json({ error: 'Could not cancel event registration.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.post(
  '/event-registrations/:id/change-ticket',
  zValidator('param', eventRegistrationParamsSchema),
  zValidator('json', changeEventRegistrationTicketSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { ticketId } = c.req.valid('json')
      const actorMembershipNumber = getActorMembershipNumber(c)

      const registration = await getEventRegistrationById(c.env.VMS_DB, id)
      if (!registration) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      if (registration.ticketId === ticketId) {
        return c.json({ error: 'أنت مسجّل بالفعل على هذه التذكرة.' }, 400)
      }

      const existingForTicket = await getEventRegistrationByEventMemberAndTicket(
        c.env.VMS_DB,
        registration.eventId,
        actorMembershipNumber,
        ticketId,
      )
      if (
        existingForTicket &&
        (existingForTicket.status === 'registered' || existingForTicket.status === 'attended')
      ) {
        return c.json({ error: 'لديك تسجيل سابق على التذكرة المختارة.' }, 409)
      }

      const event = await getEventCancellationSettingsById(c.env.VMS_DB, registration.eventId)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const authorization = canSelfModifyRegistration(event, registration, actorMembershipNumber)
      if (!authorization.allowed) {
        return c.json({ error: authorization.reason }, 403)
      }

      const ticket = await getEventTicketById(c.env.VMS_DB, ticketId)
      if (!ticket || ticket.eventId !== registration.eventId) {
        return c.json({ error: 'التذكرة المختارة غير متاحة لهذه الفعالية.' }, 400)
      }

      const activeRegistrations = ticket.activeRegistrationCount
      if (activeRegistrations >= ticket.quantity) {
        return c.json({ error: 'لم يعد هناك مقاعد متاحة لهذه التذكرة.' }, 409)
      }

      const eventRegistration = await updateEventRegistrationById(c.env.VMS_DB, id, { ticketId })
      const [enrichedRegistration] = await enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, [
        eventRegistration!,
      ])

      return c.json({ eventRegistration: enrichedRegistration })
    } catch (error) {
      if (isEventRegistrationUniqueConflict(error)) {
        return c.json({ error: 'لديك تسجيل سابق على التذكرة المختارة.' }, 409)
      }

      console.error('Failed to change event registration ticket', error)
      return c.json({ error: 'Could not change event registration ticket.' }, 500)
    }
  },
)

vmsEventRegistrationsRoute.delete('/event-registrations/:id', zValidator('param', eventRegistrationParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const actorMembershipNumber = getActorMembershipNumber(c)

    const registration = await getEventRegistrationById(c.env.VMS_DB, id)
    if (!registration) {
      return c.json({ error: 'Event registration not found.' }, 404)
    }

    const event = await getEventById(c.env.VMS_DB, registration.eventId)
    if (!event) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    const canManage = await canManageEvent(c.env.VMS_DB, event, actorMembershipNumber)
    if (!canManage) {
      return c.json({ error: 'Only event managers can delete registrations.' }, 403)
    }

    const deleted = await deleteEventRegistrationById(c.env.VMS_DB, id)
    if (!deleted) {
      return c.json({ error: 'Event registration not found.' }, 404)
    }

    return c.json({ message: 'Event registration deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete event registration', error)
    return c.json({ error: 'Could not delete event registration.' }, 500)
  }
})

vmsEventRegistrationsRoute.post(
  '/event-registrations/:id/approve',
  zValidator('param', eventRegistrationParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const approver = getActorMembershipNumber(c)
      const type = c.req.query('type')

      const existing = await getEventRegistrationById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'Event registration not found.' }, 404)
      }

      const updateData: { paymentApprovedBy?: string; attendanceApprovedBy?: string } = {}

      if (type === 'payment') {
        updateData.paymentApprovedBy = approver
      } else if (type === 'attendance') {
        updateData.attendanceApprovedBy = approver
      } else {
        return c.json({ error: 'Invalid approval type. Use "payment" or "attendance".' }, 400)
      }

      const eventRegistration = await updateEventRegistrationById(c.env.VMS_DB, id, updateData)
      const [enrichedRegistration] = await enrichEventRegistrationsWithDisplayNames(c.env.MEMBERS_DB, [
        eventRegistration!,
      ])

      return c.json({ eventRegistration: enrichedRegistration })
    } catch (error) {
      console.error('Failed to approve', error)
      return c.json({ error: 'Could not approve.' }, 500)
    }
  },
)
