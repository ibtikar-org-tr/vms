import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import {
  getEventRatingAggregates,
  listEventRatingFields,
  listLinkedEventRatings,
  replaceEventRatingFields,
} from '../repositories/vms-event-ratings.repository'
import { getEventById } from '../repositories/vms-events.repository'
import {
  createEventRatingSchema,
  replaceEventRatingFieldsSchema,
} from '../schemas/vms-event-rating.schema'
import { eventParamsSchema } from '../schemas/vms-event.schema'
import {
  evaluateEventRatingEligibility,
  submitEventRating,
} from '../services/event-rating.service'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { asciiDownloadFilename, toCsv } from '../utils/csv'
import { canManageEvent } from '../utils/event-permissions'
import { jsonValidationHook } from '../utils/zod-json-error'

export const vmsEventRatingsRoute = new Hono<AppEnv>()

async function requireManagedEvent(c: Context<AppEnv>, eventId: string) {
  const event = await getEventById(c.env.VMS_DB, eventId)
  if (!event) {
    return { event: null, error: { body: { error: 'Event not found.' }, status: 404 as const } }
  }

  const canManage = await canManageEvent(c.env.VMS_DB, event, getActorMembershipNumber(c))
  if (!canManage) {
    return {
      event: null,
      error: {
        body: { error: 'Only event admins or project managers can manage this event.' },
        status: 403 as const,
      },
    }
  }

  return { event, error: null }
}

vmsEventRatingsRoute.get('/events/:id/rating-fields', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const event = await getEventById(c.env.VMS_DB, id)
    if (!event) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    const fields = await listEventRatingFields(c.env.VMS_DB, id)
    return c.json({ fields })
  } catch (error) {
    console.error('Failed to list event rating fields', error)
    return c.json({ error: 'Could not fetch event rating fields.' }, 500)
  }
})

vmsEventRatingsRoute.put(
  '/events/:id/rating-fields',
  zValidator('param', eventParamsSchema),
  zValidator('json', replaceEventRatingFieldsSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const payload = c.req.valid('json')
      const fields = await replaceEventRatingFields(c.env.VMS_DB, id, payload.fields)
      return c.json({ fields })
    } catch (error) {
      console.error('Failed to save event rating fields', error)
      return c.json({ error: 'Could not save event rating fields.' }, 500)
    }
  },
)

vmsEventRatingsRoute.get('/events/:id/ratings/me', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)
    const eligibility = await evaluateEventRatingEligibility(c.env.VMS_DB, {
      eventId: id,
      membershipNumber,
    })

    if (!eligibility.ok) {
      return c.json({ error: eligibility.error }, eligibility.status)
    }

    return c.json({
      hasRated: eligibility.hasRated,
      canRate: eligibility.canRate,
      reason: eligibility.reason,
      rating: eligibility.rating,
      hideInfo: eligibility.hasRated ? eligibility.rating == null : null,
    })
  } catch (error) {
    console.error('Failed to fetch my event rating status', error)
    return c.json({ error: 'Could not fetch event rating status.' }, 500)
  }
})

vmsEventRatingsRoute.post(
  '/events/:id/ratings',
  zValidator('param', eventParamsSchema),
  zValidator('json', createEventRatingSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)
      const payload = c.req.valid('json')
      const result = await submitEventRating(c.env.VMS_DB, {
        eventId: id,
        membershipNumber,
        payload,
      })

      if (!result.ok) {
        return c.json({ error: result.error }, result.status)
      }

      return c.json(
        {
          hasRated: result.hasRated,
          hideInfo: result.hideInfo,
          rating: result.rating,
        },
        201,
      )
    } catch (error) {
      console.error('Failed to submit event rating', error)
      return c.json({ error: 'Could not submit event rating.' }, 500)
    }
  },
)

vmsEventRatingsRoute.get('/events/:id/ratings', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const [aggregates, ratings] = await Promise.all([
      getEventRatingAggregates(c.env.VMS_DB, id),
      listLinkedEventRatings(c.env.VMS_DB, id),
    ])

    return c.json({ aggregates, ratings, total: ratings.length })
  } catch (error) {
    console.error('Failed to list event ratings', error)
    return c.json({ error: 'Could not fetch event ratings.' }, 500)
  }
})

vmsEventRatingsRoute.get(
  '/events/:id/ratings/export',
  zValidator('param', eventParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const [fields, aggregates, ratings] = await Promise.all([
        listEventRatingFields(c.env.VMS_DB, id),
        getEventRatingAggregates(c.env.VMS_DB, id),
        listLinkedEventRatings(c.env.VMS_DB, id),
      ])

      const extraHeaders = fields.map((field) => field.label)
      const rows = ratings.map((rating) => {
        const answerByFieldId = new Map(rating.answers.map((answer) => [answer.fieldId, answer.value]))
        const answerByLabel = new Map(rating.answers.map((answer) => [answer.label, answer.value]))
        return [
          rating.membershipNumber,
          String(rating.score),
          rating.feedback ?? '',
          rating.ratedAt,
          'linked',
          ...fields.map((field) => answerByFieldId.get(field.id) ?? answerByLabel.get(field.label) ?? ''),
        ]
      })

      rows.push([
        '',
        String(aggregates.averageScore),
        `إجمالي التقييمات: ${aggregates.count} | مرتبط: ${aggregates.linkedCount} | مجهول: ${aggregates.anonymousCount}`,
        '',
        'summary',
        ...fields.map(() => ''),
      ])

      const csv = toCsv(
        ['رقم العضوية', 'التقييم', 'الملاحظات', 'تاريخ التقييم', 'النوع', ...extraHeaders],
        rows,
      )

      const filename = asciiDownloadFilename(`ratings-${id.slice(0, 8)}`, 'csv')
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`)
      c.header('Cache-Control', 'no-store')
      c.header('X-Content-Type-Options', 'nosniff')
      return c.body(csv, 200)
    } catch (error) {
      console.error('Failed to export event ratings', error)
      return c.json({ error: 'Could not export event ratings.' }, 500)
    }
  },
)
