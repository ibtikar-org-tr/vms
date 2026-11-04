import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import {
  attachEventFormSubmissionMembership,
  getEventFormSubmissionByEmail,
  getEventFormSubmissionByMembership,
  listEventFormFields,
  listEventFormSubmissions,
  replaceEventFormFields,
} from '../repositories/vms-event-forms.repository'
import { getEventById } from '../repositories/vms-events.repository'
import {
  createEventFormSubmissionSchema,
  replaceEventFormFieldsSchema,
} from '../schemas/vms-event-form.schema'
import { eventParamsSchema } from '../schemas/vms-event.schema'
import { submitEventForm } from '../services/event-form-submission.service'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber, getActorUser } from '../utils/actor'
import { asciiDownloadFilename, toCsv } from '../utils/csv'
import { canManageEvent } from '../utils/event-permissions'
import { jsonValidationHook } from '../utils/zod-json-error'

export const vmsEventFormsRoute = new Hono<AppEnv>()

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

vmsEventFormsRoute.get('/events/:id/form-fields', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const event = await getEventById(c.env.VMS_DB, id)
    if (!event) {
      return c.json({ error: 'Event not found.' }, 404)
    }

    const fields = await listEventFormFields(c.env.VMS_DB, id)
    return c.json({ fields })
  } catch (error) {
    console.error('Failed to list event form fields', error)
    return c.json({ error: 'Could not fetch event form fields.' }, 500)
  }
})

vmsEventFormsRoute.put(
  '/events/:id/form-fields',
  zValidator('param', eventParamsSchema),
  zValidator('json', replaceEventFormFieldsSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const payload = c.req.valid('json')
      const fields = await replaceEventFormFields(c.env.VMS_DB, id, payload.fields)
      return c.json({ fields })
    } catch (error) {
      console.error('Failed to save event form fields', error)
      return c.json({ error: 'Could not save event form fields.' }, 500)
    }
  },
)

vmsEventFormsRoute.post(
  '/events/:id/form-submissions',
  zValidator('param', eventParamsSchema),
  zValidator('json', createEventFormSubmissionSchema, jsonValidationHook),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const event = await getEventById(c.env.VMS_DB, id)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const membershipNumber = getActorMembershipNumber(c)
      const payload = c.req.valid('json')
      const result = await submitEventForm(c.env.VMS_DB, {
        eventId: id,
        membershipNumber,
        payload,
      })

      if (!result.ok) {
        return c.json({ error: result.error }, result.status)
      }

      return c.json({ submission: result.submission }, 201)
    } catch (error) {
      console.error('Failed to submit event form', error)
      return c.json({ error: 'Could not submit event form.' }, 500)
    }
  },
)

vmsEventFormsRoute.get(
  '/events/:id/form-submissions/me',
  zValidator('param', eventParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const event = await getEventById(c.env.VMS_DB, id)
      if (!event) {
        return c.json({ error: 'Event not found.' }, 404)
      }

      const actor = getActorUser(c)
      let submission =
        (await getEventFormSubmissionByMembership(c.env.VMS_DB, id, actor.membershipNumber)) ??
        (await getEventFormSubmissionByEmail(c.env.VMS_DB, id, actor.email))

      if (submission && !submission.membershipNumber) {
        await attachEventFormSubmissionMembership(c.env.VMS_DB, submission.id, actor.membershipNumber)
        submission =
          (await getEventFormSubmissionByMembership(c.env.VMS_DB, id, actor.membershipNumber)) ?? submission
      }

      return c.json({ submission })
    } catch (error) {
      console.error('Failed to fetch my event form submission', error)
      return c.json({ error: 'Could not fetch event form submission.' }, 500)
    }
  },
)

vmsEventFormsRoute.get(
  '/events/:id/form-submissions/export',
  zValidator('param', eventParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const managed = await requireManagedEvent(c, id)
      if (managed.error) {
        return c.json(managed.error.body, managed.error.status)
      }

      const [fields, submissions] = await Promise.all([
        listEventFormFields(c.env.VMS_DB, id),
        listEventFormSubmissions(c.env.VMS_DB, id),
      ])

      const extraHeaders = fields.map((field) => field.label)
      const csv = toCsv(
        ['الاسم', 'البريد', 'الهاتف', 'رقم العضوية', 'تاريخ الإرسال', ...extraHeaders],
        submissions.map((submission) => {
          const answerByFieldId = new Map(submission.answers.map((answer) => [answer.fieldId, answer.value]))
          const answerByLabel = new Map(submission.answers.map((answer) => [answer.label, answer.value]))
          return [
            submission.applicantName,
            submission.applicantEmail,
            submission.applicantPhone,
            submission.membershipNumber,
            submission.createdAt,
            ...fields.map((field) => answerByFieldId.get(field.id) ?? answerByLabel.get(field.label) ?? ''),
          ]
        }),
      )

      const filename = asciiDownloadFilename(`applications-${id.slice(0, 8)}`, 'csv')
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`)
      c.header('Cache-Control', 'no-store')
      c.header('X-Content-Type-Options', 'nosniff')
      return c.body(csv, 200)
    } catch (error) {
      console.error('Failed to export event form submissions', error)
      return c.json({ error: 'Could not export event form submissions.' }, 500)
    }
  },
)

vmsEventFormsRoute.get('/events/:id/form-submissions', zValidator('param', eventParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const managed = await requireManagedEvent(c, id)
    if (managed.error) {
      return c.json(managed.error.body, managed.error.status)
    }

    const submissions = await listEventFormSubmissions(c.env.VMS_DB, id)
    return c.json({ submissions, total: submissions.length })
  } catch (error) {
    console.error('Failed to list event form submissions', error)
    return c.json({ error: 'Could not fetch event form submissions.' }, 500)
  }
})

