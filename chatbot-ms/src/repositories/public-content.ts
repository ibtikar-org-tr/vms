export interface PublicEventRow {
  id: string
  name: string
  description: string | null
  start_time: string | null
  end_time: string | null
  status: string
  country: string | null
  region: string | null
  city: string | null
  address: string | null
  project_name: string | null
}

export interface OpenPositionRow {
  id: string
  name: string
  description: string | null
  seats: number
  status: string
  project_id: string
  project_name: string | null
}

export interface ActiveProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  parent_project_id: string | null
}

export async function listPublicEvents(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT events.id, events.name, events.description, events.start_time, events.end_time,
              events.status, events.country, events.region, events.city, events.address,
              projects.name AS project_name
       FROM events
       LEFT JOIN projects ON projects.id = events.project_id
       WHERE events.status = ?
       ORDER BY events.start_time IS NULL, events.start_time DESC`,
    )
    .bind('public')
    .all<PublicEventRow>()

  return result.results ?? []
}

export async function listOpenVolunteeringPositions(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT positions.id, positions.name, positions.description, positions.seats, positions.status,
              positions.project_id, projects.name AS project_name
       FROM positions
       LEFT JOIN projects ON projects.id = positions.project_id
       WHERE positions.status = ?
       ORDER BY positions.created_at DESC`,
    )
    .bind('open')
    .all<OpenPositionRow>()

  return result.results ?? []
}

export async function listActivePrograms(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, name, description, status, parent_project_id
       FROM projects
       WHERE status = ?
       ORDER BY name ASC`,
    )
    .bind('active')
    .all<ActiveProjectRow>()

  return result.results ?? []
}
