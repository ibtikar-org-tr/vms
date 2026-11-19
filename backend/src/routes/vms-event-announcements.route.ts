import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import {
  createEventAnnouncement,
  getEventAnnouncementById,
  isMissingEventAnnouncementFailuresTable,
  isMissingEventAnnouncementsTable,
  listEventAnnouncementFailures,
  listEventAnnouncements,
} from '../repositories/event-announcements.repository'
import {
  createEventAnnouncementSchema,
  eventAnnouncementEventParamsSchema,
  eventAnnouncementParamsSchema,
  retryEventAnnouncementSchema,
} from '../schemas/event-announcement.schema'
import {
  deliverEventAnnouncement,
  enqueueEventAnnouncementDelivery,
  eventAnnouncementNeedsContinue,
  loadEventAnnouncementAudience,
  startFailedEventAnnouncementRetry,
} from '../services/event-announcement.service'
import { describeTelegramFailure } from '../services/assembly-announcement.service'
import { listAssemblyMemberContacts } from '../repositories/assembly-members.repository'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { canManageEvent } from '../utils/event-permissions'
import { getEventById } from '../repositories/vms-events.repository'
import { generateId } from '../utils/id'
import { jsonValidationHook } from '../utils/zod-json-error'

export const vmsEventAnnouncementsRoute = new Hono<AppEnv>()

async function requireManagedEvent(c: Context<AppEnv>, eventId: string) {
  const event = await getEventById(c.env.VMS_DB, eventId)
  if (!event) {
    return {
      event: null,
      membershipNumber: null as string | null,
      error: { body: { error: 'الفعالية غير موجودة.' }, status: 404 as const },
    }
  }

  const membershipNumber = getActorMembershipNumber(c)
  const canManage = await canManageEvent(c.env.VMS_DB, event, membershipNumber)
  if (!canManage) {
    return {
      event: null,
      membershipNumber,
      error: { body: { error: 'هذه الصفحة متاحة لمسؤولي الفعالية ومديري المشروع فقط.' }, status: 403 as const },
    }
  }

  return { event, membershipNumber, error: null }
}

vmsEventAnnouncementsRoute.get(
  '/events/:eventId/announcements',
  zValidator('param', eventAnnouncementEventParamsSchema),
  async (c) => {
    const { eventId } = c.req.valid('param')
    const access = await requireManagedEvent(c, eventId)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const [announcements, audience] = await Promise.all([
        listEventAnnouncements(c.env.VMS_DB, eventId),
        loadEventAnnouncementAudience(c.env, eventId),
      ])
      return c.json({ announcements, audience: audience.audience })
    } catch (error) {
      if (isMissingEventAnnouncementsTable(error)) {
        return c.json({ announcements: [], audience: { people: 0, email: 0, telegram: 0 } })
      }
      console.error('Failed to list event announcements', error)
      return c.json({ error: 'تعذر تحميل الرسائل السابقة.' }, 500)
    }
  },
)

vmsEventAnnouncementsRoute.get(
  '/events/:eventId/announcements/:announcementId',
  zValidator('param', eventAnnouncementParamsSchema),
  async (c) => {
    const { eventId, announcementId } = c.req.valid('param')
    const access = await requireManagedEvent(c, eventId)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const announcement = await getEventAnnouncementById(c.env.VMS_DB, announcementId)
      if (!announcement || announcement.eventId !== eventId) {
        return c.json({ error: 'الرسالة غير موجودة.' }, 404)
      }

      let failures: Awaited<ReturnType<typeof listEventAnnouncementFailures>> = []
      try {
        failures = await listEventAnnouncementFailures(c.env.VMS_DB, announcementId)
      } catch (error) {
        if (!isMissingEventAnnouncementFailuresTable(error)) {
          throw error
        }
      }

      const contacts = await listAssemblyMemberContacts(
        c.env.MEMBERS_DB,
        failures.map((item) => item.membershipNumber ?? ''),
      )
      const contactByNumber = new Map(contacts.map((contact) => [contact.membershipNumber, contact]))
      const presentedFailures = failures.map((item) => {
        const contact = item.membershipNumber ? contactByNumber.get(item.membershipNumber) : undefined
        return {
          ...item,
          email: item.email || contact?.email || null,
          displayName: item.displayName || contact?.displayName || item.membershipNumber,
          phoneNumber: contact?.phoneNumber || null,
          telegramUsername: contact?.telegramUsername || null,
          error: item.channel === 'telegram' ? describeTelegramFailure(item.error) : item.error,
        }
      })

      const needsContinue = await eventAnnouncementNeedsContinue(c.env, announcement)
      return c.json({ announcement, failures: presentedFailures, needsContinue })
    } catch (error) {
      if (isMissingEventAnnouncementsTable(error)) {
        return c.json({ error: 'جدول الرسائل غير جاهز بعد. أعد المحاولة بعد دقائق.' }, 503)
      }
      console.error('Failed to load event announcement', error)
      return c.json({ error: 'تعذر تحميل الرسالة.' }, 500)
    }
  },
)

vmsEventAnnouncementsRoute.post(
  '/events/:eventId/announcements',
  zValidator('param', eventAnnouncementEventParamsSchema),
  zValidator('json', createEventAnnouncementSchema, jsonValidationHook),
  async (c) => {
    const { eventId } = c.req.valid('param')
    const access = await requireManagedEvent(c, eventId)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const payload = c.req.valid('json')
      const sendEmail = payload.sendEmail !== false
      const sendTelegram = payload.sendTelegram !== false
      const { audience } = await loadEventAnnouncementAudience(c.env, eventId)
      const emailCount = sendEmail ? audience.email : 0
      const telegramCount = sendTelegram ? audience.telegram : 0
      const createdBy = access.membershipNumber
      if (!createdBy) {
        return c.json({ error: 'تعذر تحديد المرسل.' }, 401)
      }

      if (emailCount === 0 && telegramCount === 0) {
        return c.json({ error: 'لا يوجد مسجّلون يمكن إرسال الرسالة إليهم على القنوات المختارة.' }, 400)
      }

      const created = await createEventAnnouncement(c.env.VMS_DB, {
        id: generateId(),
        eventId,
        createdBy,
        subject: payload.subject,
        body: payload.body,
        sendEmail,
        sendTelegram,
        emailTotal: emailCount,
        telegramTotal: telegramCount,
      })

      if (!created) {
        return c.json({ error: 'تعذر إنشاء الرسالة.' }, 500)
      }

      let announcement = created
      const queued = await enqueueEventAnnouncementDelivery(c.env, created.id)
      let needsContinue = true

      if (!queued) {
        try {
          announcement = (await deliverEventAnnouncement(c.env, created.id)) ?? created
          needsContinue = await eventAnnouncementNeedsContinue(c.env, announcement)
        } catch (error) {
          console.error('Failed first event announcement batch', error)
          needsContinue = true
        }
      }

      return c.json(
        {
          announcement,
          queued,
          needsContinue: queued || needsContinue,
          audience: { email: emailCount, telegram: telegramCount, people: audience.people },
        },
        201,
      )
    } catch (error) {
      if (isMissingEventAnnouncementsTable(error) || isMissingEventAnnouncementFailuresTable(error)) {
        return c.json({ error: 'جدول الرسائل غير جاهز بعد. أعد المحاولة بعد دقائق.' }, 503)
      }
      console.error('Failed to create event announcement', error)
      return c.json({ error: 'تعذر إرسال الرسالة.' }, 500)
    }
  },
)

vmsEventAnnouncementsRoute.post(
  '/events/:eventId/announcements/:announcementId/continue',
  zValidator('param', eventAnnouncementParamsSchema),
  async (c) => {
    const { eventId, announcementId } = c.req.valid('param')
    const access = await requireManagedEvent(c, eventId)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const existing = await getEventAnnouncementById(c.env.VMS_DB, announcementId)
      if (!existing || existing.eventId !== eventId) {
        return c.json({ error: 'الرسالة غير موجودة.' }, 404)
      }

      const queued = await enqueueEventAnnouncementDelivery(c.env, announcementId)
      if (queued) {
        const announcement = await getEventAnnouncementById(c.env.VMS_DB, announcementId)
        const needsContinue = announcement ? await eventAnnouncementNeedsContinue(c.env, announcement) : false
        return c.json({ announcement, queued: true, needsContinue })
      }

      const announcement = await deliverEventAnnouncement(c.env, announcementId)
      const needsContinue = announcement ? await eventAnnouncementNeedsContinue(c.env, announcement) : false
      return c.json({ announcement, queued: false, needsContinue })
    } catch (error) {
      console.error('Failed to continue event announcement', error)
      return c.json({ error: 'تعذر متابعة الإرسال.', retryable: true }, 500)
    }
  },
)

vmsEventAnnouncementsRoute.post(
  '/events/:eventId/announcements/:announcementId/retry',
  zValidator('param', eventAnnouncementParamsSchema),
  zValidator('json', retryEventAnnouncementSchema, jsonValidationHook),
  async (c) => {
    const { eventId, announcementId } = c.req.valid('param')
    const access = await requireManagedEvent(c, eventId)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const existing = await getEventAnnouncementById(c.env.VMS_DB, announcementId)
      if (!existing || existing.eventId !== eventId) {
        return c.json({ error: 'الرسالة غير موجودة.' }, 404)
      }

      const { channel } = c.req.valid('json')
      const started = await startFailedEventAnnouncementRetry(c.env, announcementId, channel)
      if (started.error === 'missing' || !started.announcement) {
        return c.json({ error: 'الرسالة غير موجودة.' }, 404)
      }
      if (started.error === 'in_progress') {
        return c.json({ error: 'الإرسال الأصلي ما زال جارياً. انتظر أو اضغط متابعة الإرسال.' }, 409)
      }
      if (started.error === 'busy') {
        return c.json({ error: 'إعادة إرسال القناة الأخرى جارية الآن. انتظر حتى تنتهي ثم أعد المحاولة.' }, 409)
      }
      if (started.error === 'none') {
        return c.json(
          { error: channel === 'telegram' ? 'لا يوجد فشل تيليغرام لإعادة الإرسال.' : 'لا يوجد فشل بريد لإعادة الإرسال.' },
          400,
        )
      }

      const queued = await enqueueEventAnnouncementDelivery(c.env, announcementId)
      if (queued) {
        const announcement = await getEventAnnouncementById(c.env.VMS_DB, announcementId)
        const needsContinue = announcement ? await eventAnnouncementNeedsContinue(c.env, announcement) : false
        return c.json({ announcement, queued: true, needsContinue })
      }

      const announcement = await deliverEventAnnouncement(c.env, announcementId)
      const needsContinue = announcement ? await eventAnnouncementNeedsContinue(c.env, announcement) : false
      return c.json({ announcement, queued: false, needsContinue })
    } catch (error) {
      console.error('Failed to retry event announcement failures', error)
      return c.json({ error: 'تعذر إعادة إرسال الفاشلين.', retryable: true }, 500)
    }
  },
)
