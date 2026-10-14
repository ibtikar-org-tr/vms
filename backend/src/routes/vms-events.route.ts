import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { getUserDisplayNamesByMembershipNumbers, searchMembershipNumbers } from '../repositories/user-info.repository'
import { getUserByMembershipNumber } from '../repositories/users.repository'
import {
  addEventAdmin,
  isEventAdmin,
  listEventAdmins,
  removeEventAdmin,
} from '../repositories/vms-event-admins.repository'
import { createEvent, deleteEventById, getEventById, listEvents, updateEventById } from '../repositories/vms-events.repository'
import {
  createEventSchema,
  eventAdminBodySchema,
  eventAdminParamsSchema,
  eventParamsSchema,
  updateEventSchema,
} from '../schemas/vms-event.schema'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { canManageEvent } from '../utils/event-permissions'
import { canManageProject } from '../utils/project-access'
import { jsonValidationHook } from '../utils/zod-json-error'

export const vmsEventsRoute = new Hono<AppEnv>()

async function withCanManage<T extends { id: string; createdBy: string; projectId: string | null }>(
  db: AppEnv['Bindings']['VMS_DB'],
  event: T,
  membershipNumber: string,
) {
  return {
    ...event,
    canManage: await canManageEvent(db, event, membershipNumber),
  }
}

async function requireManagedEvent(c: Context<AppEnv>, eventId: string) {
  const event = await getEventById(c.env.VMS_DB, eventId)
  if (!event) {
    return { event: null, error: { body: { error: 'Event not found.' }, status: 404 as const } }
  }

  const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
  if (!canManage) {
    return {
      event: null,
      error: { body: { error: 'Only event admins or project managers can manage this event.' }, status: 403 as const },
    }
  }

  return { event, error: null }
}

vmsEventsRoute.get('/events', async (c) => {
  try {
    const events = await listEvents(c.env.VMS_DB)
    return c.json({ events })
  } catch (error) {
    console.error('Failed to list events', error)
    return c.json({ error: 'Could not fetch events.' }, 500)
  }
})

vmsEventsRoute.get('/events/:id/admins', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const assigned = await listEventAdmins(c.env.VMS_DB, managed.event.id)
    const membershipNumbers = [
      managed.event.createdBy,
      ...assigned.map((admin) => admin.membershipNumber),
    ]
    const displayNameMap = await getUserDisplayNamesByMembershipNumbers(c.env.MEMBERS_DB, membershipNumbers)

    const assignedNumbers = new Set(assigned.map((admin) => admin.membershipNumber))
    const admins = [
      {
        membershipNumber: managed.event.createdBy,
        displayName: displayNameMap.get(managed.event.createdBy) ?? managed.event.createdBy,
        source: 'creator' as const,
        grantedBy: null,
      },
      ...assigned
        .filter((admin) => admin.membershipNumber !== managed.event.createdBy)
        .map((admin) => ({
          membershipNumber: admin.membershipNumber,
          displayName: displayNameMap.get(admin.membershipNumber) ?? admin.membershipNumber,
          source: 'assigned' as const,
          grantedBy: admin.grantedBy,
        })),
    ]

    return c.json({
      admins,
      note: 'مدراء المشروع ومجلس الإدارة (المشاريع الأب) يملكون صلاحية الإدارة تلقائياً.',
      assignedCount: assignedNumbers.size,
    })
  } catch (error) {
    console.error('Failed to list event admins', error)
    return c.json({ error: 'Could not fetch event admins.' }, 500)
  }
})

vmsEventsRoute.get('/events/:id/admin-candidates', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const query = c.req.query('q')?.trim() ?? ''
    if (query.length < 2) {
      return c.json({ candidates: [] })
    }

    const membershipNumbers = await searchMembershipNumbers(c.env.MEMBERS_DB, query, 12)
    const displayNameMap = await getUserDisplayNamesByMembershipNumbers(c.env.MEMBERS_DB, membershipNumbers)

    return c.json({
      candidates: membershipNumbers.map((membershipNumber) => ({
        membershipNumber,
        displayName: displayNameMap.get(membershipNumber) ?? membershipNumber,
      })),
    })
  } catch (error) {
    console.error('Failed to search event admin candidates', error)
    return c.json({ error: 'Could not search members.' }, 500)
  }
})

vmsEventsRoute.post(
  '/events/:id/admins',
  zValidator('param', eventParamsSchema),
  zValidator('json', eventAdminBodySchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const { membershipNumber } = c.req.valid('json')
      const member = await getUserByMembershipNumber(c.env.MEMBERS_DB, membershipNumber)
      if (!member) {
        return c.json({ error: 'لا يوجد عضو بهذا الرقم.' }, 404)
      }

      if (member.membership_number === managed.event.createdBy) {
        return c.json({ error: 'منشئ الفعالية مدير بالفعل.' }, 409)
      }

      if (await isEventAdmin(c.env.VMS_DB, managed.event.id, member.membership_number)) {
        return c.json({ error: 'هذا العضو مدير للفعالية مسبقاً.' }, 409)
      }

      const admin = await addEventAdmin(
        c.env.VMS_DB,
        managed.event.id,
        member.membership_number,
        getActorMembershipNumber(c),
      )
      const displayNameMap = await getUserDisplayNamesByMembershipNumbers(c.env.MEMBERS_DB, [admin.membershipNumber])

      return c.json(
        {
          admin: {
            membershipNumber: admin.membershipNumber,
            displayName: displayNameMap.get(admin.membershipNumber) ?? admin.membershipNumber,
            source: 'assigned' as const,
            grantedBy: admin.grantedBy,
          },
        },
        201,
      )
    } catch (error) {
      console.error('Failed to add event admin', error)
      return c.json({ error: 'Could not add event admin.' }, 500)
    }
  },
)

vmsEventsRoute.delete('/events/:id/admins/:membershipNumber', zValidator('param', eventAdminParamsSchema), async (c) => {
  try {
    const { id, membershipNumber } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const deleted = await removeEventAdmin(c.env.VMS_DB, managed.event.id, membershipNumber)
    if (!deleted) {
      return c.json({ error: 'Event admin not found.' }, 404)
    }

    return c.json({ message: 'Event admin removed successfully.' })
  } catch (error) {
    console.error('Failed to remove event admin', error)
    return c.json({ error: 'Could not remove event admin.' }, 500)
  }
})

vmsEventsRoute.get('/events/:id', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const event = await getEventById(c.env.VMS_DB, id)

    if (!event) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    return c.json({ event: await withCanManage(c.env.VMS_DB, event, getActorMembershipNumber(c)) })
  } catch (error) {
    console.error('Failed to fetch event', error)
    return c.json({ error: 'Could not fetch event.' }, 500)
  }
})

vmsEventsRoute.post('/events', zValidator('json', createEventSchema), async (c) => {
  try {
    const payload = c.req.valid('json')
    const actorMembershipNumber = getActorMembershipNumber(c)

    const authorization = await canManageProject(c.env.VMS_DB, payload.projectId, actorMembershipNumber)
    if (!authorization.project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    if (!authorization.isAuthorized) {
      return c.json({ error: 'Only project owner or managers can create events for this project.' }, 403)
    }

    const eventId = crypto.randomUUID()
    const event = await createEvent(c.env.VMS_DB, eventId, {
      ...payload,
      createdBy: actorMembershipNumber,
    })
    if (!event) {
      return c.json({ error: 'Could not create event.' }, 500)
    }

    return c.json({ event: await withCanManage(c.env.VMS_DB, event, actorMembershipNumber) }, 201)
  } catch (error) {
    console.error('Failed to create event', error)
    return c.json({ error: 'Could not create event.' }, 500)
  }
})

vmsEventsRoute.put(
  '/events/:id',
  zValidator('param', eventParamsSchema),
  zValidator('json', updateEventSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const payload = c.req.valid('json')
      const event = await updateEventById(c.env.VMS_DB, managed.event.id, payload)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      return c.json({ event: await withCanManage(c.env.VMS_DB, event, getActorMembershipNumber(c)) })
    } catch (error) {
      console.error('Failed to update event', error)
      return c.json({ error: 'Could not update event.' }, 500)
    }
  },
)

vmsEventsRoute.delete('/events/:id', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const deleted = await deleteEventById(c.env.VMS_DB, managed.event.id)
    if (!deleted) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    return c.json({ message: 'Event deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete event', error)
    return c.json({ error: 'Could not delete event.' }, 500)
  }
})
