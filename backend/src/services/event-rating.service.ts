import type { CreateEventRatingInput } from '../schemas/vms-event-rating.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { getEventRegistrationByEventAndMember } from '../repositories/vms-event-registrations.repository'
import {
  createEventRatingSubmission,
  getEventRatingById,
  getEventRatingRaterByMembership,
  isEventRatingUniqueConflict,
  listEventRatingFields,
  updateEventRatingById,
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
  | 'anonymous_locked'

type UpdateEventRatingInput = {
  score: number
  feedback?: string
  answers?: Record<string, string>
}

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

function canModifyWindow(event: {
  ratingsEnabled?: boolean
  ratingsDeadlineAt?: string | null
}) {
  return Boolean(event.ratingsEnabled) && !isDeadlinePassed(event.ratingsDeadlineAt)
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
  const hideInfo = hasRated ? linkedRating == null : null
  const openWindow = canModifyWindow(event)

  if (hasRated) {
    const canEdit = openWindow && linkedRating != null
    let reason: RatingEligibilityReason = 'already_rated'
    if (!openWindow) {
      reason = event.ratingsEnabled ? 'deadline_passed' : 'ratings_disabled'
    } else if (hideInfo) {
      reason = 'anonymous_locked'
    }

    return {
      ok: true as const,
      event,
      hasRated: true,
      canRate: false,
      canEdit,
      reason,
      rater,
      rating: linkedRating,
      hideInfo,
    }
  }

  if (!event.ratingsEnabled) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      canEdit: false,
      reason: 'ratings_disabled' as RatingEligibilityReason,
      rater: null,
      rating: null as EventRatingRecord | null,
      hideInfo: null,
    }
  }

  if (isDeadlinePassed(event.ratingsDeadlineAt)) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      canEdit: false,
      reason: 'deadline_passed' as RatingEligibilityReason,
      rater: null,
      rating: null,
      hideInfo: null,
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
      canEdit: false,
      reason: 'not_registered' as RatingEligibilityReason,
      rater: null,
      rating: null,
      hideInfo: null,
    }
  }

  if (event.ratingsRequireAttendanceApproved && !registration.attendanceApprovedBy) {
    return {
      ok: true as const,
      event,
      hasRated: false,
      canRate: false,
      canEdit: false,
      reason: 'attendance_not_approved' as RatingEligibilityReason,
      rater: null,
      rating: null,
      hideInfo: null,
    }
  }

  return {
    ok: true as const,
    event,
    hasRated: false,
    canRate: true,
    canEdit: false,
    reason: null,
    rater: null,
    rating: null,
    hideInfo: null,
  }
}

async function buildValidatedAnswers(db: D1DatabaseLike, eventId: string, answers: Record<string, string> | undefined) {
  const fields = await listEventRatingFields(db, eventId)
  return buildEventRatingAnswers(fields, answers)
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
      already_rated: 'لقد قمت بتقييم هذه الفعالية مسبقاً. يمكنك تعديل تقييمك إن كان مرتبطاً بهويتك.',
      anonymous_locked: 'لقد قمت بتقييم هذه الفعالية مع إخفاء الهوية ولا يمكن تعديل التقييم لاحقاً.',
    }
    const reason = eligibility.reason ?? 'ratings_disabled'
    return {
      ok: false as const,
      status: reason === 'already_rated' || reason === 'anonymous_locked' ? (409 as const) : (403 as const),
      error: messages[reason],
    }
  }

  const built = await buildValidatedAnswers(db, input.eventId, input.payload.answers)
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
      canEdit: !created.hideInfo,
    }
  } catch (error) {
    if (isEventRatingUniqueConflict(error)) {
      return { ok: false as const, status: 409 as const, error: 'لقد قمت بتقييم هذه الفعالية مسبقاً.' }
    }
    throw error
  }
}

export async function updateEventRating(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string
    payload: UpdateEventRatingInput
  },
) {
  const eligibility = await evaluateEventRatingEligibility(db, {
    eventId: input.eventId,
    membershipNumber: input.membershipNumber,
  })

  if (!eligibility.ok) {
    return { ok: false as const, status: eligibility.status, error: eligibility.error }
  }

  if (!eligibility.canEdit || !eligibility.rating) {
    const messages: Record<RatingEligibilityReason, string> = {
      ratings_disabled: 'التقييم غير مفعّل لهذه الفعالية.',
      deadline_passed: 'انتهى موعد تعديل التقييم لهذه الفعالية.',
      not_registered: 'يجب أن تكون مسجلاً في الفعالية لتتمكن من التقييم.',
      attendance_not_approved: 'التقييم متاح فقط للمشاركين الذين تم اعتماد حضورهم.',
      already_rated: 'لا يمكن تعديل هذا التقييم.',
      anonymous_locked:
        'لا يمكن تعديل التقييم لأنك أخفيت هويتك عند الإرسال، ولا يمكن ربط الإجابات بعضويتك.',
    }
    const reason = eligibility.reason ?? 'already_rated'
    return {
      ok: false as const,
      status: reason === 'anonymous_locked' ? (403 as const) : (403 as const),
      error: messages[reason],
    }
  }

  const built = await buildValidatedAnswers(db, input.eventId, input.payload.answers)
  if (!built.ok) {
    return { ok: false as const, status: 400 as const, error: built.error }
  }

  const feedback = input.payload.feedback?.trim() ? input.payload.feedback.trim() : null
  const rating = await updateEventRatingById(db, eligibility.rating.id, {
    score: input.payload.score,
    feedback,
    answers: built.answers,
  })

  if (!rating) {
    return { ok: false as const, status: 500 as const, error: 'تعذر تحديث التقييم.' }
  }

  return {
    ok: true as const,
    rating,
    hasRated: true,
    hideInfo: false,
    canEdit: true,
  }
}
