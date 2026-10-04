import type { CreateEventInput, UpdateEventInput } from '../schemas/vms-event.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { mapCancellationDeadlineHours } from '../utils/event-registration-cancellation'
import { getAssociatedSkills, replaceAssociatedSkills } from './skills-association.repository'

interface EventRow {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  start_time: string | null
  end_time: string | null
  status: string
  image_url: string | null
  associated_urls: string | null
  created_by: string
  project_id: string | null
  project_name: string | null
  project_owner: string | null
  telegram_group_id: string | null
  country: string | null
  region: string | null
  city: string | null
  address: string | null
  display_attendee_numbers: number | null
  cancellation_deadline_hours: number | null
  allow_guest_registration: number | null
  registration_success_message: string | null
}

function mapDisplayAttendeeNumbers(value: number | null | undefined) {
  return value === undefined || value === null || value === 1
}

function mapAllowGuestRegistration(value: number | null | undefined) {
  return value === 1
}

function parseJsonObject(data: string | null): Record<string, unknown> | null {
  if (!data) {
    return null
  }

  try {
    const parsed = JSON.parse(data)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }

    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function mapEventRow(row: EventRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    imageUrl: row.image_url,
    associatedUrls: parseJsonObject(row.associated_urls),
    createdBy: row.created_by,
    projectId: row.project_id,
    projectName: row.project_name,
    projectOwner: row.project_owner,
    skills: null,
    telegramGroupId: row.telegram_group_id,
    country: row.country,
    region: row.region,
    city: row.city,
    address: row.address,
    displayAttendeeNumbers: mapDisplayAttendeeNumbers(row.display_attendee_numbers),
    cancellationDeadlineHours: mapCancellationDeadlineHours(row.cancellation_deadline_hours),
    allowGuestRegistration: mapAllowGuestRegistration(row.allow_guest_registration),
    registrationSuccessMessage: row.registration_success_message ?? null,
  }
}

async function hydrateEventRow(db: D1DatabaseLike, row: EventRow) {
  const event = mapEventRow(row)
  let skills: Record<string, string> | null = null

  try {
    skills = await getAssociatedSkills(db, 'event', event.id)
  } catch (error) {
    console.error('Failed to load associated skills for event', event.id, error)
  }

  return {
    ...event,
    skills,
  }
}

export async function listEvents(db: D1DatabaseLike) {
  const result = await db
    .prepare(
      `SELECT
         events.*,
         projects.name AS project_name,
         projects.owner AS project_owner
       FROM events
       LEFT JOIN projects ON projects.id = events.project_id
       ORDER BY events.created_at DESC`,
    )
    .bind()
    .all<EventRow>()

  return Promise.all(result.results.map((row) => hydrateEventRow(db, row)))
}

export async function getEventById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare(
      `SELECT
         events.*,
         projects.name AS project_name,
         projects.owner AS project_owner
       FROM events
       LEFT JOIN projects ON projects.id = events.project_id
       WHERE events.id = ?`,
    )
    .bind(id)
    .first<EventRow>()

  return row ? hydrateEventRow(db, row) : null
}

interface EventCancellationSettingsRow {
  start_time: string | null
  status: string
  cancellation_deadline_hours: number | null
}

export async function getEventCancellationSettingsById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare('SELECT start_time, status, cancellation_deadline_hours FROM events WHERE id = ?')
    .bind(id)
    .first<EventCancellationSettingsRow>()

  if (!row) {
    return null
  }

  return {
    startTime: row.start_time,
    status: row.status,
    cancellationDeadlineHours: mapCancellationDeadlineHours(row.cancellation_deadline_hours),
  }
}

export async function createEvent(db: D1DatabaseLike, id: string, input: CreateEventInput) {
  await db
    .prepare(
      'INSERT INTO events (id, name, description, start_time, end_time, image_url, associated_urls, created_by, project_id, status, telegram_group_id, country, region, city, address, display_attendee_numbers, cancellation_deadline_hours, allow_guest_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      input.name,
      input.description ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
      input.imageUrl ?? null,
      input.associatedUrls && Object.keys(input.associatedUrls).length > 0
        ? JSON.stringify(input.associatedUrls)
        : null,
      input.createdBy,
      input.projectId ?? null,
      input.status,
      input.telegramGroupId ?? null,
      input.country ?? null,
      input.region ?? null,
      input.city ?? null,
      input.address ?? null,
      input.displayAttendeeNumbers === false ? 0 : 1,
      input.cancellationDeadlineHours !== undefined ? mapCancellationDeadlineHours(input.cancellationDeadlineHours) : 48,
      input.allowGuestRegistration === true ? 1 : 0,
    )
    .run()

  await replaceAssociatedSkills(db, 'event', id, input.skills ?? null)

  if (input.registrationSuccessMessage !== undefined) {
    return updateEventById(db, id, { registrationSuccessMessage: input.registrationSuccessMessage })
  }

  return getEventById(db, id)
}

export async function updateEventById(db: D1DatabaseLike, id: string, input: UpdateEventInput) {
  const updates: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }

  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description?.trim() ? input.description : null)
  }

  if (input.startTime !== undefined) {
    updates.push('start_time = ?')
    values.push(input.startTime)
  }

  if (input.endTime !== undefined) {
    updates.push('end_time = ?')
    values.push(input.endTime)
  }

  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }

  if (input.imageUrl !== undefined) {
    updates.push('image_url = ?')
    values.push(input.imageUrl ?? null)
  }

  if (input.associatedUrls !== undefined) {
    updates.push('associated_urls = ?')
    values.push(
      input.associatedUrls && Object.keys(input.associatedUrls).length > 0
        ? JSON.stringify(input.associatedUrls)
        : null,
    )
  }

  if (input.createdBy !== undefined) {
    updates.push('created_by = ?')
    values.push(input.createdBy)
  }

  if (input.projectId !== undefined) {
    updates.push('project_id = ?')
    values.push(input.projectId)
  }

  if (input.telegramGroupId !== undefined) {
    updates.push('telegram_group_id = ?')
    values.push(input.telegramGroupId)
  }

  if (input.country !== undefined) {
    updates.push('country = ?')
    values.push(input.country ?? null)
  }

  if (input.region !== undefined) {
    updates.push('region = ?')
    values.push(input.region ?? null)
  }

  if (input.city !== undefined) {
    updates.push('city = ?')
    values.push(input.city ?? null)
  }

  if (input.address !== undefined) {
    updates.push('address = ?')
    values.push(input.address ?? null)
  }

  if (input.displayAttendeeNumbers !== undefined) {
    updates.push('display_attendee_numbers = ?')
    values.push(input.displayAttendeeNumbers ? 1 : 0)
  }

  if (input.cancellationDeadlineHours !== undefined) {
    updates.push('cancellation_deadline_hours = ?')
    values.push(mapCancellationDeadlineHours(input.cancellationDeadlineHours))
  }

  if (input.allowGuestRegistration !== undefined) {
    updates.push('allow_guest_registration = ?')
    values.push(input.allowGuestRegistration ? 1 : 0)
  }

  const registrationSuccessMessage = input.registrationSuccessMessage

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")

    await db
      .prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values, id)
      .run()
  }

  if (registrationSuccessMessage !== undefined) {
    try {
      await db
        .prepare(`UPDATE events SET registration_success_message = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(registrationSuccessMessage?.trim() ? registrationSuccessMessage : null, id)
        .run()
    } catch (error) {
      console.error('Failed to save event registration success message', error)
    }
  }

  if (updates.length === 0 && registrationSuccessMessage === undefined) {
    return getEventById(db, id)
  }

  if (input.skills !== undefined) {
    await replaceAssociatedSkills(db, 'event', id, input.skills ?? null)
  }

  return getEventById(db, id)
}

export async function deleteEventById(db: D1DatabaseLike, id: string) {
  const existing = await getEventById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return true
}
