import type { CreateProjectMemberInput, UpdateProjectMemberInput } from '../schemas/vms-project-member.schema'
import type { D1DatabaseLike } from '../types/bindings'

interface ProjectMemberRow {
  project_id: string
  membership_number: string
  role: string
}

function mapProjectMemberRow(row: ProjectMemberRow) {
  return {
    projectId: row.project_id,
    membershipNumber: row.membership_number,
    role: row.role,
    displayName: row.membership_number,
  }
}

const MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE = 80

export async function listProjectNamesByMembershipNumbers(
  db: D1DatabaseLike,
  membershipNumbers: string[],
) {
  const unique = [...new Set(membershipNumbers.map((value) => value.trim()).filter(Boolean))]
  const projectsByMember = new Map<string, string[]>()

  for (let index = 0; index < unique.length; index += MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE) {
    const batch = unique.slice(index, index + MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE)
    const placeholders = batch.map(() => '?').join(', ')
    const result = await db
      .prepare(
        `SELECT pm.membership_number AS membershipNumber, p.name AS projectName
         FROM project_members pm
         INNER JOIN projects p ON p.id = pm.project_id
         WHERE pm.membership_number IN (${placeholders})
         ORDER BY p.name ASC`,
      )
      .bind(...batch)
      .all<{ membershipNumber: string; projectName: string }>()

    for (const row of result.results) {
      const current = projectsByMember.get(row.membershipNumber) ?? []
      if (!current.includes(row.projectName)) {
        current.push(row.projectName)
      }
      projectsByMember.set(row.membershipNumber, current)
    }
  }

  return projectsByMember
}

export async function listProjectMembers(db: D1DatabaseLike, projectId?: string) {
  const query = projectId
    ? 'SELECT project_id, membership_number, role FROM project_members WHERE project_id = ? ORDER BY membership_number ASC'
    : 'SELECT project_id, membership_number, role FROM project_members ORDER BY project_id ASC, membership_number ASC'

  const statement = db.prepare(query)
  const result = projectId ? await statement.bind(projectId).all<ProjectMemberRow>() : await statement.bind().all<ProjectMemberRow>()

  return result.results.map(mapProjectMemberRow)
}

export async function getProjectMember(db: D1DatabaseLike, projectId: string, membershipNumber: string) {
  const row = await db
    .prepare('SELECT project_id, membership_number, role FROM project_members WHERE project_id = ? AND membership_number = ?')
    .bind(projectId, membershipNumber)
    .first<ProjectMemberRow>()

  return row ? mapProjectMemberRow(row) : null
}

export async function createProjectMember(db: D1DatabaseLike, input: CreateProjectMemberInput) {
  await db
    .prepare('INSERT INTO project_members (project_id, membership_number, role) VALUES (?, ?, ?)')
    .bind(input.projectId, input.membershipNumber, input.role)
    .run()

  return getProjectMember(db, input.projectId, input.membershipNumber)
}

/** Insert or update the member role for a project (used for owner mirroring / transfer). */
export async function upsertProjectMember(
  db: D1DatabaseLike,
  input: CreateProjectMemberInput,
) {
  await db
    .prepare(
      `INSERT INTO project_members (project_id, membership_number, role) VALUES (?, ?, ?)
       ON CONFLICT(project_id, membership_number) DO UPDATE SET role = excluded.role`,
    )
    .bind(input.projectId, input.membershipNumber, input.role)
    .run()

  return getProjectMember(db, input.projectId, input.membershipNumber)
}

export async function updateProjectMember(
  db: D1DatabaseLike,
  projectId: string,
  membershipNumber: string,
  input: UpdateProjectMemberInput,
) {
  const updates: string[] = []
  const values: unknown[] = []

  if (input.projectId !== undefined) {
    updates.push('project_id = ?')
    values.push(input.projectId)
  }

  if (input.membershipNumber !== undefined) {
    updates.push('membership_number = ?')
    values.push(input.membershipNumber)
  }

  if (input.role !== undefined) {
    updates.push('role = ?')
    values.push(input.role)
  }

  if (updates.length === 0) {
    return getProjectMember(db, projectId, membershipNumber)
  }

  await db
    .prepare(`UPDATE project_members SET ${updates.join(', ')} WHERE project_id = ? AND membership_number = ?`)
    .bind(...values, projectId, membershipNumber)
    .run()

  const nextProjectId = input.projectId ?? projectId
  const nextMembershipNumber = input.membershipNumber ?? membershipNumber
  return getProjectMember(db, nextProjectId, nextMembershipNumber)
}

export async function deleteProjectMember(db: D1DatabaseLike, projectId: string, membershipNumber: string) {
  const existing = await getProjectMember(db, projectId, membershipNumber)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM project_members WHERE project_id = ? AND membership_number = ?').bind(projectId, membershipNumber).run()
  return true
}
