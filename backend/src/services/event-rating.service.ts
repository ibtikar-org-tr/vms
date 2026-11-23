import type { CreateEventRatingInput } from '../schemas/vms-event-rating.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { getEventRegistrationByEventAndMember } from '../repositories/vms-event-registrations.repository'
import {
  createEventRatingSubmission,
  getEventRatingById,
  getEventRatingRaterByMembership,
  isEventRatingUniqueConflict,
  listEventRatingFields,
  type EventRatingAnswer,
  type EventRatingFieldRecord,
  type EventRatingRecord,
} from '../repositories/vms-event-ratings.repository'
import { getEventById } from '../repositories/vms-events.repository'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\/\S+$/i

export type RatingEligibilityReason =
  | 'ratings_disabled'
  | 'deadline_passed'
  | 'not_registered'
  | 'attendance_not_approved'
  | 'already_rated'

function validateAnswerValue(field: EventRatingFieldRecord, value: string) {
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

export function buildEventRatingAnswers(
  fields: EventRatingFieldRecord[],
  answers: Record<string, string> | undefined,
) {
  const submitted = answers ?? {}
  const built: EventRatingAnswer[] = []

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

function isDeadlinePassed(deadlineAt: string | null | undefined) {
  if (!deadlineAt) {
    return false
  }

  const deadlineMs = Date.parse(deadlineAt)
  if (Number.isNaN(deadlineMs)) {
    return false
  }

  return Date.now() > deadlineMs
}

export async function evaluateEventRatingEligibility(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string
  },
) {
  const event = await getEventById(db, input.eventId)
  if (!event) {
    return { ok: false as const, status: 404 as const, error: 'Event not found.', event: null }
  }

  const rater = await getEventRatingRaterByMembership(db, input.eventId, input.membershipNumber)
  const hasRated = Boolean(rater)
  const linkedRating =
    rater?.ratingId != null ? await getEventRatingById(db, rater.ratingId) : null

  if (hasRated) {
    return {
      ok: true as const,
      event,
      hasRated: true,
      canRate: false,
      reason: 'already_rated' as RatingEligibilityReason,
      rater,
      rating: linkedRating,
    }
  }

  if (!event.ratingsEnabled) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      reason: 'ratings_disabled' as RatingEligibilityReason,
      rater: null,
      rating: null as EventRatingRecord | null,
    }
  }

  if (isDeadlinePassed(event.ratingsDeadlineAt)) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      reason: 'deadline_passed' as RatingEligibilityReason,
      rater: null,
      rating: null,
    }
  }

  const registration = await getEventRegistrationByEventAndMember(
    db,
    input.eventId,
    input.membershipNumber,
  )

  if (!registration) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      reason: 'not_registered' as RatingEligibilityReason,
      rater: null,
      rating: null,
    }
  }

  if (event.ratingsRequireAttendanceApproved && !registration.attendanceApprovedBy) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      reason: 'attendance_not_approved' as RatingEligibilityReason,
      rater: null,
      rating: null,
    }
  }

  return {
    ok: true as const,
    event,
    hasRated: false,
    canRate: true,
    reason: null,
    rater: null,
    rating: null,
  }
}

export async function submitEventRating(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string
    payload: CreateEventRatingInput
  },
) {
  const eligibility = await evaluateEventRatingEligibility(db, {
    eventId: input.eventId,
    membershipNumber: input.membershipNumber,
  })

  if (!eligibility.ok) {
    return { ok: false as const, status: eligibility.status, error: eligibility.error }
  }

  if (!eligibility.canRate) {
    const messages: Record<RatingEligibilityReason, string> = {
      ratings_disabled: 'التقييم غير مفعّل لهذه الفعالية.',
      deadline_passed: 'انتهى موعد التقييم لهذه الفعالية.',
      not_registered: 'يجب أن تكون مسجلاً في الفعالية لتتمكن من التقييم.',
      attendance_not_approved: 'التقييم متاح فقط للمشاركين الذين تم اعتماد حضورهم.',
      already_rated: 'لقد قمت بتقييم هذه الفعالية مسبقاً.',
    }
    const reason = eligibility.reason ?? 'ratings_disabled'
    return {
      ok: false as const,
      status: reason === 'already_rated' ? (409 as const) : (403 as const),
      error: messages[reason],
    }
  }

  const fields = await listEventRatingFields(db, input.eventId)
  const built = buildEventRatingAnswers(fields, input.payload.answers)
  if (!built.ok) {
    return { ok: false as const, status: 400 as const, error: built.error }
  }

  const feedback = input.payload.feedback?.trim() ? input.payload.feedback.trim() : null

  try {
    const created = await createEventRatingSubmission(db, {
      eventId: input.eventId,
      membershipNumber: input.membershipNumber,
      score: input.payload.score,
      feedback,
      answers: built.answers,
      hideInfo: Boolean(input.payload.hideInfo),
    })

    if (!created.rating || !created.rater) {
      return { ok: false as const, status: 500 as const, error: 'تعذر حفظ التقييم.' }
    }

    return {
      ok: true as const,
      rating: created.hideInfo ? null : created.rating,
      hasRated: true,
      hideInfo: created.hideInfo,
    }
  } catch (error) {
    if (isEventRatingUniqueConflict(error)) {
      return { ok: false as const, status: 409 as const, error: 'لقد قمت بتقييم هذه الفعالية مسبقاً.' }
    }
    throw error
  }
}
