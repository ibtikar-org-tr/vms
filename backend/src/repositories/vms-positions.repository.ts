import type {
  CreatePositionApplicationInput,
  CreatePositionInput,
  ReviewPositionApplicationInput,
  UpdatePositionInput,
} from '../schemas/vms-position.schema'
import type { D1DatabaseLike } from '../types/bindings'

interface PositionRow {
  id: string
  created_at: string
  updated_at: string
  project_id: string
  project_name: string | null
  name: string
  description: string | null
  created_by: string
  seats: number
  status: string
}

interface PositionApplicationRow {
  id: string
  created_at: string
  updated_at: string
  position_id: string
  membership_number: string
  motivation_letter: string | null
  status: string
  reviewed_by: string | null
}

function mapPositionRow(row: PositionRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectId: row.project_id,
    projectName: row.project_name,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    seats: row.seats,
    status: row.status,
  }
}

function mapPositionApplicationRow(row: PositionApplicationRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    positionId: row.position_id,
    membershipNumber: row.membership_number,
    motivationLetter: row.motivation_letter,
    status: row.status,
    reviewedBy: row.reviewed_by,
  }
}

async function countAcceptedApplications(db: D1DatabaseLike, positionId: string) {
  const result = await db
    .prepare('SELECT COUNT(*) AS count FROM position_applications WHERE position_id = ? AND status = ?')
    .bind(positionId, 'accepted')
    .first<{ count: number }>()

  return Number(result?.count ?? 0)
}

export async function listProjectPositions(db: D1DatabaseLike, projectId: string) {
  const result = await db
    .prepare(
      `SELECT positions.id, positions.created_at, positions.updated_at, positions.project_id, projects.name AS project_name, positions.name, positions.description, positions.created_by, positions.seats, positions.status
       FROM positions
       LEFT JOIN projects ON projects.id = positions.project_id
       WHERE project_id = ?
      ORDER BY positions.created_at DESC`,
    )
    .bind(projectId)
    .all<PositionRow>()

  return Promise.all(
    result.results.map(async (row) => ({
      ...mapPositionRow(row),
      acceptedApplicationsCount: await countAcceptedApplications(db, row.id),
      applications: await listPositionApplications(db, row.id),
    })),
  )
}

export async function listOpenPositions(db: D1DatabaseLike) {
  const result = await db
    .prepare(
      `SELECT positions.id, positions.created_at, positions.updated_at, positions.project_id, projects.name AS project_name, positions.name, positions.description, positions.created_by, positions.seats, positions.status
       FROM positions
       LEFT JOIN projects ON projects.id = positions.project_id
       WHERE positions.status = ?
       ORDER BY positions.created_at DESC`,
    )
    .bind('open')
    .all<PositionRow>()

  return Promise.all(
    result.results.map(async (row) => ({
      ...mapPositionRow(row),
      acceptedApplicationsCount: await countAcceptedApplications(db, row.id),
      applications: await listPositionApplications(db, row.id),
    })),
  )
}

export async function getPositionById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare(
      'SELECT positions.id, positions.created_at, positions.updated_at, positions.project_id, projects.name AS project_name, positions.name, positions.description, positions.created_by, positions.seats, positions.status FROM positions LEFT JOIN projects ON projects.id = positions.project_id WHERE positions.id = ?',
    )
    .bind(id)
    .first<PositionRow>()

  return row ? mapPositionRow(row) : null
}

export async function createPosition(db: D1DatabaseLike, input: CreatePositionInput) {
  const id = crypto.randomUUID()

  await db
    .prepare(
      'INSERT INTO positions (id, project_id, name, description, created_by, seats, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      input.projectId,
      input.name,
      input.description ?? null,
      input.createdBy,
      input.seats ?? 1,
      input.status ?? 'open',
    )
    .run()

  return getPositionById(db, id)
}

export async function updatePosition(db: D1DatabaseLike, id: string, input: UpdatePositionInput) {
  const updates: string[] = []
  const values: unknown[] = []

  if (input.projectId !== undefined) {
    updates.push('project_id = ?')
    values.push(input.projectId)
  }

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }

  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description ?? null)
  }

  if (input.createdBy !== undefined) {
    updates.push('created_by = ?')
    values.push(input.createdBy)
  }

  if (input.seats !== undefined) {
    updates.push('seats = ?')
    values.push(input.seats)
  }

  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }

  if (updates.length === 0) {
    return getPositionById(db, id)
  }

  updates.push("updated_at = datetime('now')")

  await db
    .prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run()

  return getPositionById(db, id)
}

export async function deletePosition(db: D1DatabaseLike, id: string) {
  const existing = await getPositionById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM positions WHERE id = ?').bind(id).run()
  return true
}

export async function listPositionApplications(db: D1DatabaseLike, positionId: string) {
  const result = await db
    .prepare(
      `SELECT id, created_at, updated_at, position_id, membership_number, motivation_letter, status, reviewed_by
       FROM position_applications
       WHERE position_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(positionId)
    .all<PositionApplicationRow>()

  return result.results.map(mapPositionApplicationRow)
}

export async function getPositionApplicationById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare(
      'SELECT id, created_at, updated_at, position_id, membership_number, motivation_letter, status, reviewed_by FROM position_applications WHERE id = ?',
    )
    .bind(id)
    .first<PositionApplicationRow>()

  return row ? mapPositionApplicationRow(row) : null
}

export async function createPositionApplication(
  db: D1DatabaseLike,
  input: CreatePositionApplicationInput & { positionId: string; membershipNumber: string },
) {
  const existing = await db
    .prepare('SELECT id FROM position_applications WHERE position_id = ? AND membership_number = ?')
    .bind(input.positionId, input.membershipNumber)
    .first<{ id: string }>()

  if (existing) {
    return null
  }

  const id = crypto.randomUUID()

  await db
    .prepare(
      'INSERT INTO position_applications (id, position_id, membership_number, motivation_letter, status, reviewed_by) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, input.positionId, input.membershipNumber, input.motivationLetter ?? null, 'pending', null)
    .run()

  return getPositionApplicationById(db, id)
}

export async function updatePositionApplication(
  db: D1DatabaseLike,
  id: string,
  input: ReviewPositionApplicationInput & { reviewedBy: string },
) {
  const existing = await getPositionApplicationById(db, id)

  if (!existing) {
    return null
  }

  await db
    .prepare('UPDATE position_applications SET status = ?, reviewed_by = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(input.status, input.reviewedBy, id)
    .run()

  return getPositionApplicationById(db, id)
}

export async function deletePositionApplicationById(db: D1DatabaseLike, id: string) {
  const existing = await getPositionApplicationById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM position_applications WHERE id = ?').bind(id).run()
  return true
}

export async function getPositionByIdWithApplications(db: D1DatabaseLike, id: string) {
  const position = await getPositionById(db, id)

  if (!position) {
    return null
  }

  return {
    ...position,
    acceptedApplicationsCount: await countAcceptedApplications(db, id),
    applications: await listPositionApplications(db, id),
  }
}

export async function syncPositionAfterReview(db: D1DatabaseLike, positionId: string) {
  const position = await getPositionById(db, positionId)

  if (!position) {
    return null
  }

  const acceptedApplicationsCount = await countAcceptedApplications(db, positionId)
  const nextStatus = position.status === 'closed' ? 'closed' : acceptedApplicationsCount >= position.seats ? 'filled' : 'open'

  if (position.status !== nextStatus) {
    await db
      .prepare("UPDATE positions SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(nextStatus, positionId)
      .run()
  }

  return getPositionByIdWithApplications(db, positionId)
}