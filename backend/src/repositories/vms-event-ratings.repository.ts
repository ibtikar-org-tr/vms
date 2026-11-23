import type { EventRatingFieldInput, EventRatingFieldType } from '../schemas/vms-event-rating.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { generateId } from '../utils/id'

interface EventRatingFieldRow {
  id: string
  created_at: string
  updated_at: string
  event_id: string
  label: string
  description: string | null
  type: string
  required: number
  sort_order: number
}

interface EventRatingRow {
  id: string
  created_at: string
  event_id: string
  score: number
  feedback: string | null
  answers: string
}

interface EventRatingRaterRow {
  id: string
  created_at: string
  event_id: string
  membership_number: string
  rating_id: string | null
}

export type EventRatingAnswer = {
  fieldId: string
  label: string
  value: string
}

export type EventRatingFieldRecord = {
  id: string
  createdAt: string
  updatedAt: string
  eventId: string
  label: string
  description: string | null
  type: EventRatingFieldType
  required: boolean
  sortOrder: number
}

export type EventRatingRecord = {
  id: string
  createdAt: string
  eventId: string
  score: number
  feedback: string | null
  answers: EventRatingAnswer[]
}

export type EventRatingRaterRecord = {
  id: string
  createdAt: string
  eventId: string
  membershipNumber: string
  ratingId: string | null
}

export type LinkedEventRatingRecord = EventRatingRecord & {
  membershipNumber: string
  ratedAt: string
}

function isMissingTable(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table') && message.includes(table)
}

function mapFieldRow(row: EventRatingFieldRow): EventRatingFieldRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventId: row.event_id,
    label: row.label,
    description: row.description,
    type: row.type as EventRatingFieldType,
    required: row.required === 1,
    sortOrder: row.sort_order,
  }
}

function parseAnswers(raw: string): EventRatingAnswer[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return []
      }

      const record = item as { fieldId?: unknown; label?: unknown; value?: unknown }
      if (typeof record.fieldId !== 'string' || typeof record.label !== 'string') {
        return []
      }

      return [
        {
          fieldId: record.fieldId,
          label: record.label,
          value: typeof record.value === 'string' ? record.value : '',
        },
      ]
    })
  } catch {
    return []
  }
}

function mapRatingRow(row: EventRatingRow): EventRatingRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    eventId: row.event_id,
    score: row.score,
    feedback: row.feedback,
    answers: parseAnswers(row.answers),
  }
}

function mapRaterRow(row: EventRatingRaterRow): EventRatingRaterRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    eventId: row.event_id,
    membershipNumber: row.membership_number,
    ratingId: row.rating_id,
  }
}

export async function listEventRatingFields(db: D1DatabaseLike, eventId: string) {
  try {
    const result = await db
      .prepare(
        `SELECT id, created_at, updated_at, event_id, label, description, type, required, sort_order
         FROM event_rating_fields
         WHERE event_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(eventId)
      .all<EventRatingFieldRow>()

    return (result.results ?? []).map(mapFieldRow)
  } catch (error) {
    if (isMissingTable(error, 'event_rating_fields')) {
      return []
    }
    throw error
  }
}

export async function replaceEventRatingFields(
  db: D1DatabaseLike,
  eventId: string,
  fields: EventRatingFieldInput[],
) {
  await db.prepare('DELETE FROM event_rating_fields WHERE event_id = ?').bind(eventId).run()

  const created: EventRatingFieldRecord[] = []
  for (const [index, field] of fields.entries()) {
    const id = generateId()
    const required = field.required === false ? 0 : 1
    const description = field.description?.trim() ? field.description.trim() : null

    await db
      .prepare(
        `INSERT INTO event_rating_fields (id, event_id, label, description, type, required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, eventId, field.label.trim(), description, field.type, required, index)
      .run()

    created.push({
      id,
      createdAt: '',
      updatedAt: '',
      eventId,
      label: field.label.trim(),
      description,
      type: field.type,
      required: required === 1,
      sortOrder: index,
    })
  }

  return listEventRatingFields(db, eventId).then((rows) => (rows.length > 0 ? rows : created))
}

export async function getEventRatingRaterByMembership(
  db: D1DatabaseLike,
  eventId: string,
  membershipNumber: string,
) {
  try {
    const row = await db
      .prepare(
        `SELECT id, created_at, event_id, membership_number, rating_id
         FROM event_rating_raters
         WHERE event_id = ? AND membership_number = ?
         LIMIT 1`,
      )
      .bind(eventId, membershipNumber)
      .first<EventRatingRaterRow>()

    return row ? mapRaterRow(row) : null
  } catch (error) {
    if (isMissingTable(error, 'event_rating_raters')) {
      return null
    }
    throw error
  }
}

export async function getEventRatingById(db: D1DatabaseLike, ratingId: string) {
  try {
    const row = await db
      .prepare(
        `SELECT id, created_at, event_id, score, feedback, answers
         FROM event_ratings
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(ratingId)
      .first<EventRatingRow>()

    return row ? mapRatingRow(row) : null
  } catch (error) {
    if (isMissingTable(error, 'event_ratings')) {
      return null
    }
    throw error
  }
}

export async function getEventRatingAggregates(db: D1DatabaseLike, eventId: string) {
  try {
    const [ratingStats, raterStats] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(AVG(score), 0) AS average_score
           FROM event_ratings
           WHERE event_id = ?`,
        )
        .bind(eventId)
        .first<{ count: number; average_score: number }>(),
      db
        .prepare(
          `SELECT
             COUNT(*) AS rater_count,
             SUM(CASE WHEN rating_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_count
           FROM event_rating_raters
           WHERE event_id = ?`,
        )
        .bind(eventId)
        .first<{ rater_count: number; linked_count: number | null }>(),
    ])

    const count = Number(ratingStats?.count ?? 0)
    const averageScore = count > 0 ? Number(ratingStats?.average_score ?? 0) : 0
    const raterCount = Number(raterStats?.rater_count ?? 0)
    const linkedCount = Number(raterStats?.linked_count ?? 0)

    return {
      count,
      averageScore: Math.round(averageScore * 100) / 100,
      linkedCount,
      anonymousCount: Math.max(0, raterCount - linkedCount),
      raterCount,
    }
  } catch (error) {
    if (isMissingTable(error, 'event_ratings') || isMissingTable(error, 'event_rating_raters')) {
      return { count: 0, averageScore: 0, linkedCount: 0, anonymousCount: 0, raterCount: 0 }
    }
    throw error
  }
}

export async function listLinkedEventRatings(db: D1DatabaseLike, eventId: string, limit = 2000) {
  try {
    const result = await db
      .prepare(
        `SELECT
           rating.id,
           rating.created_at,
           rating.event_id,
           rating.score,
           rating.feedback,
           rating.answers,
           rater.membership_number,
           rater.created_at AS rated_at
         FROM event_rating_raters rater
         INNER JOIN event_ratings rating ON rating.id = rater.rating_id
         WHERE rater.event_id = ? AND rater.rating_id IS NOT NULL
         ORDER BY rater.created_at DESC
         LIMIT ?`,
      )
      .bind(eventId, Math.min(Math.max(limit, 1), 5000))
      .all<
        EventRatingRow & {
          membership_number: string
          rated_at: string
        }
      >()

    return (result.results ?? []).map((row) => ({
      ...mapRatingRow(row),
      membershipNumber: row.membership_number,
      ratedAt: row.rated_at,
    })) satisfies LinkedEventRatingRecord[]
  } catch (error) {
    if (isMissingTable(error, 'event_ratings') || isMissingTable(error, 'event_rating_raters')) {
      return []
    }
    throw error
  }
}

export function isEventRatingUniqueConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE constraint failed') && message.includes('event_rating_raters')
}

export async function createEventRatingSubmission(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string
    score: number
    feedback: string | null
    answers: EventRatingAnswer[]
    hideInfo: boolean
  },
) {
  const ratingId = generateId()
  const raterId = generateId()
  const answersJson = JSON.stringify(input.answers)
  const linkedRatingId = input.hideInfo ? null : ratingId

  await db
    .prepare(
      `INSERT INTO event_ratings (id, event_id, score, feedback, answers)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(ratingId, input.eventId, input.score, input.feedback, answersJson)
    .run()

  await db
    .prepare(
      `INSERT INTO event_rating_raters (id, event_id, membership_number, rating_id)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(raterId, input.eventId, input.membershipNumber, linkedRatingId)
    .run()

  const rating = await getEventRatingById(db, ratingId)
  const rater = await getEventRatingRaterByMembership(db, input.eventId, input.membershipNumber)

  return { rating, rater, hideInfo: input.hideInfo }
}

export async function updateEventRatingById(
  db: D1DatabaseLike,
  ratingId: string,
  input: {
    score: number
    feedback: string | null
    answers: EventRatingAnswer[]
  },
) {
  await db
    .prepare(
      `UPDATE event_ratings
       SET score = ?, feedback = ?, answers = ?
       WHERE id = ?`,
    )
    .bind(input.score, input.feedback, JSON.stringify(input.answers), ratingId)
    .run()

  return getEventRatingById(db, ratingId)
}
