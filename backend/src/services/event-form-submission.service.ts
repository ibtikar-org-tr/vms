import type { CreateEventFormSubmissionInput } from '../schemas/vms-event-form.schema'
import type { D1DatabaseLike } from '../types/bindings'
import {
  createEventFormSubmission,
  getEventFormSubmissionByEmail,
  getEventFormSubmissionByMembership,
  listEventFormFields,
  type EventFormAnswer,
  type EventFormFieldRecord,
} from '../repositories/vms-event-forms.repository'
import { getEventById } from '../repositories/vms-events.repository'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\/\S+$/i

export function isEventFormUniqueConflict(error: unknown) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed') && error.message.includes('event_form_submissions')
}

function validateAnswerValue(field: EventFormFieldRecord, value: string) {
  if (!value) {
    return field.required ? `يرجى تعبئة حقل "${field.label}".` : null
  }

  if (field.type === 'email' && !EMAIL_PATTERN.test(value)) {
    return `البريد في حقل "${field.label}" غير صالح.`
  }

  if (field.type === 'url' && !URL_PATTERN.test(value)) {
    return `الرابط في حقل "${field.label}" يجب أن يبدأ بـ http:// أو https://.`
  }

  if (field.type === 'number' && Number.isNaN(Number(value))) {
    return `حقل "${field.label}" يجب أن يكون رقماً.`
  }

  return null
}

export function buildEventFormAnswers(
  fields: EventFormFieldRecord[],
  answers: Record<string, string> | undefined,
) {
  const submitted = answers ?? {}
  const built: EventFormAnswer[] = []

  for (const field of fields) {
    const value = typeof submitted[field.id] === 'string' ? submitted[field.id].trim() : ''
    const error = validateAnswerValue(field, value)
    if (error) {
      return { ok: false as const, error }
    }

    built.push({
      fieldId: field.id,
      label: field.label,
      value,
    })
  }

  return { ok: true as const, answers: built }
}

export async function submitEventForm(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string | null
    payload: CreateEventFormSubmissionInput
  },
) {
  const event = await getEventById(db, input.eventId)
  if (!event) {
    return { ok: false as const, status: 404 as const, error: 'Event not found.' }
  }

  const fields = await listEventFormFields(db, input.eventId)
  if (fields.length === 0) {
    return { ok: false as const, status: 400 as const, error: 'لا يوجد نموذج تقديم لهذه الفعالية.' }
  }

  const name = input.payload.applicantName.trim()
  const email = input.payload.applicantEmail.trim().toLowerCase()
  const phone = input.payload.applicantPhone.trim()
  const requireContact = event.requireApplicantContact !== false

  if (requireContact) {
    if (!name) {
      return { ok: false as const, status: 400 as const, error: 'يرجى تعبئة الاسم الكامل.' }
    }
    if (!email || !EMAIL_PATTERN.test(email)) {
      return { ok: false as const, status: 400 as const, error: 'يرجى إدخال بريد إلكتروني صالح.' }
    }
    if (!phone) {
      return { ok: false as const, status: 400 as const, error: 'يرجى تعبئة رقم الهاتف.' }
    }
  } else if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false as const, status: 400 as const, error: 'البريد الإلكتروني غير صالح.' }
  }

  if (email) {
    const existingByEmail = await getEventFormSubmissionByEmail(db, input.eventId, email)
    if (existingByEmail) {
      return { ok: false as const, status: 409 as const, error: 'تم إرسال طلب بهذا البريد مسبقاً.' }
    }
  }

  if (input.membershipNumber) {
    const existingByMember = await getEventFormSubmissionByMembership(db, input.eventId, input.membershipNumber)
    if (existingByMember) {
      return { ok: false as const, status: 409 as const, error: 'لقد أرسلت طلباً لهذه الفعالية مسبقاً.' }
    }
  }

  const built = buildEventFormAnswers(fields, input.payload.answers)
  if (!built.ok) {
    return { ok: false as const, status: 400 as const, error: built.error }
  }

  try {
    const submission = await createEventFormSubmission(db, {
      eventId: input.eventId,
      membershipNumber: input.membershipNumber,
      applicantName: name,
      applicantEmail: email,
      applicantPhone: phone,
      answers: built.answers,
    })

    if (!submission) {
      return { ok: false as const, status: 500 as const, error: 'تعذر حفظ الطلب.' }
    }

    return { ok: true as const, submission }
  } catch (error) {
    if (isEventFormUniqueConflict(error)) {
      return { ok: false as const, status: 409 as const, error: 'تم إرسال طلب بهذا البريد مسبقاً.' }
    }
    throw error
  }
}
