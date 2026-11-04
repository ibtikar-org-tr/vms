import type { EventFormFieldInput, EventFormFieldType } from '../schemas/vms-event-form.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { generateId } from '../utils/id'

interface EventFormFieldRow {
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

interface EventFormSubmissionRow {
  id: string
  created_at: string
  event_id: string
  membership_number: string | null
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  answers: string
}

export type EventFormAnswer = {
  fieldId: string
  label: string
  value: string
}

export type EventFormFieldRecord = {
  id: string
  createdAt: string
  updatedAt: string
  eventId: string
  label: string
  description: string | null
  type: EventFormFieldType
  required: boolean
  sortOrder: number
}

export type EventFormSubmissionRecord = {
  id: string
  createdAt: string
  eventId: string
  membershipNumber: string | null
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  answers: EventFormAnswer[]
}

function isMissingEventFormTable(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table') && message.includes(table)
}

function mapEventFormFieldRow(row: EventFormFieldRow): EventFormFieldRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventId: row.event_id,
    label: row.label,
    description: row.description,
    type: row.type as EventFormFieldType,
    required: row.required === 1,
    sortOrder: row.sort_order,
  }
}

function parseAnswers(raw: string): EventFormAnswer[] {
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

function mapEventFormSubmissionRow(row: EventFormSubmissionRow): EventFormSubmissionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    eventId: row.event_id,
    membershipNumber: row.membership_number,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    answers: parseAnswers(row.answers),
  }
}

export async function listEventFormFields(db: D1DatabaseLike, eventId: string) {
  try {
    const result = await db
      .prepare(
        `SELECT id, created_at, updated_at, event_id, label, description, type, required, sort_order
         FROM event_form_fields
         WHERE event_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(eventId)
      .all<EventFormFieldRow>()

    return (result.results ?? []).map(mapEventFormFieldRow)
  } catch (error) {
    if (isMissingEventFormTable(error, 'event_form_fields')) {
      return []
    }
    throw error
  }
}

export async function replaceEventFormFields(
  db: D1DatabaseLike,
  eventId: string,
  fields: EventFormFieldInput[],
) {
  await db.prepare('DELETE FROM event_form_fields WHERE event_id = ?').bind(eventId).run()

  const created: EventFormFieldRecord[] = []
  for (const [index, field] of fields.entries()) {
    const id = generateId()
    const required = field.required === false ? 0 : 1
    const description = field.description?.trim() ? field.description.trim() : null

    await db
      .prepare(
        `INSERT INTO event_form_fields (id, event_id, label, description, type, required, sort_order)
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

  return listEventFormFields(db, eventId).then((rows) => (rows.length > 0 ? rows : created))
}

export async function getEventFormSubmissionByEmail(db: D1DatabaseLike, eventId: string, email: string) {
  try {
    const row = await db
      .prepare(
        `SELECT id, created_at, event_id, membership_number, applicant_name, applicant_email, applicant_phone, answers
         FROM event_form_submissions
         WHERE event_id = ? AND applicant_email = ?
         LIMIT 1`,
      )
      .bind(eventId, email.trim().toLowerCase())
      .first<EventFormSubmissionRow>()

    return row ? mapEventFormSubmissionRow(row) : null
  } catch (error) {
    if (isMissingEventFormTable(error, 'event_form_submissions')) {
      return null
    }
    throw error
  }
}

export async function getEventFormSubmissionByMembership(
  db: D1DatabaseLike,
  eventId: string,
  membershipNumber: string,
) {
  try {
    const row = await db
      .prepare(
        `SELECT id, created_at, event_id, membership_number, applicant_name, applicant_email, applicant_phone, answers
         FROM event_form_submissions
         WHERE event_id = ? AND membership_number = ?
         LIMIT 1`,
      )
      .bind(eventId, membershipNumber)
      .first<EventFormSubmissionRow>()

    return row ? mapEventFormSubmissionRow(row) : null
  } catch (error) {
    if (isMissingEventFormTable(error, 'event_form_submissions')) {
      return null
    }
    throw error
  }
}

export async function listEventFormSubmissions(db: D1DatabaseLike, eventId: string, limit = 2000) {
  try {
    const result = await db
      .prepare(
        `SELECT id, created_at, event_id, membership_number, applicant_name, applicant_email, applicant_phone, answers
         FROM event_form_submissions
         WHERE event_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(eventId, Math.min(Math.max(limit, 1), 5000))
      .all<EventFormSubmissionRow>()

    return (result.results ?? []).map(mapEventFormSubmissionRow)
  } catch (error) {
    if (isMissingEventFormTable(error, 'event_form_submissions')) {
      return []
    }
    throw error
  }
}

export async function attachEventFormSubmissionMembership(
  db: D1DatabaseLike,
  submissionId: string,
  membershipNumber: string,
) {
  try {
    await db
      .prepare(
        `UPDATE event_form_submissions
         SET membership_number = ?
         WHERE id = ? AND membership_number IS NULL`,
      )
      .bind(membershipNumber, submissionId)
      .run()
  } catch (error) {
    if (isEventFormUniqueConflictSafe(error) || isMissingEventFormTable(error, 'event_form_submissions')) {
      return
    }
    throw error
  }
}

function isEventFormUniqueConflictSafe(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE constraint failed') && message.includes('event_form_submissions')
}

export async function createEventFormSubmission(
  db: D1DatabaseLike,
  input: {
    eventId: string
    membershipNumber: string | null
    applicantName: string
    applicantEmail: string
    applicantPhone: string
    answers: EventFormAnswer[]
  },
) {
  const id = generateId()
  await db
    .prepare(
      `INSERT INTO event_form_submissions (
         id, event_id, membership_number, applicant_name, applicant_email, applicant_phone, answers
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.eventId,
      input.membershipNumber,
      input.applicantName,
      input.applicantEmail.trim().toLowerCase(),
      input.applicantPhone,
      JSON.stringify(input.answers),
    )
    .run()

  return getEventFormSubmissionByEmail(db, input.eventId, input.applicantEmail)
}
