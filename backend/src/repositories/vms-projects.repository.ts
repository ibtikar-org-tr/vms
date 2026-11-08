import type { D1DatabaseLike } from '../types/bindings'
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/vms-project.schema'
import { getAssociatedSkills, replaceAssociatedSkills } from './skills-association.repository'

interface ProjectRow {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  parent_project_id: string | null
  owner: string
  telegram_group_id: string | null
  status: string
}

export interface ProjectRecord {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  description: string | null
  parentProjectId: string | null
  owner: string
  telegramGroupId: string | null
  skills: Record<string, string> | null
  status: string
}

export interface PublicProjectRecord {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  description: string | null
  parentProjectId: string | null
  owner: string
  telegramGroupId: string | null
  skills: Record<string, string> | null
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    description: row.description,
    parentProjectId: row.parent_project_id,
    owner: row.owner,
    telegramGroupId: row.telegram_group_id,
    status: row.status,
    skills: null,
  }
}

function toPublicProjectRecord(project: ProjectRecord): PublicProjectRecord {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    name: project.name,
    description: project.description,
    parentProjectId: project.parentProjectId,
    owner: project.owner,
    telegramGroupId: project.telegramGroupId,
    skills: project.skills,
  }
}

async function listProjectRows(db: D1DatabaseLike): Promise<ProjectRecord[]> {
  const result = await db
    .prepare('SELECT id, created_at, updated_at, name, description, parent_project_id, owner, telegram_group_id, status FROM projects ORDER BY created_at DESC')
    .bind()
    .all<ProjectRow>()

  const projects = result.results.map(mapProjectRow)

  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      skills: await getAssociatedSkills(db, 'project', project.id),
    })),
  )
}

async function getDirectVisibleProjectIds(db: D1DatabaseLike, membershipNumber: string): Promise<Set<string>> {
  const normalizedMembershipNumber = membershipNumber.trim()

  const result = await db
    .prepare(
      `SELECT id
       FROM projects
       WHERE owner = ?
       UNION
       SELECT project_id AS id
       FROM project_members
       WHERE membership_number = ?`,
    )
    .bind(normalizedMembershipNumber, normalizedMembershipNumber)
    .all<{ id: string }>()

  return new Set(result.results.map((row) => row.id))
}

function getVisibleProjectIds(projects: ProjectRecord[], directVisibleIds: Set<string>): Set<string> {
  const visibleIds = new Set(directVisibleIds)
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const childrenByParentId = new Map<string, string[]>()

  for (const project of projects) {
    if (!project.parentProjectId) {
      continue
    }

    const siblings = childrenByParentId.get(project.parentProjectId)
    if (siblings) {
      siblings.push(project.id)
    } else {
      childrenByParentId.set(project.parentProjectId, [project.id])
    }
  }

  for (const projectId of directVisibleIds) {
    let currentProject = projectById.get(projectId)
    const visitedAncestorIds = new Set<string>()

    while (currentProject?.parentProjectId && !visitedAncestorIds.has(currentProject.parentProjectId)) {
      const parentProjectId = currentProject.parentProjectId
      visitedAncestorIds.add(parentProjectId)

      if (visibleIds.has(parentProjectId)) {
        currentProject = projectById.get(parentProjectId)
        continue
      }

      visibleIds.add(parentProjectId)
      currentProject = projectById.get(parentProjectId)
    }
  }

  const queue = [...directVisibleIds]
  const visitedDescendantIds = new Set<string>(directVisibleIds)

  while (queue.length > 0) {
    const currentProjectId = queue.shift()
    if (!currentProjectId) {
      continue
    }

    const childProjectIds = childrenByParentId.get(currentProjectId) ?? []
    for (const childProjectId of childProjectIds) {
      if (visitedDescendantIds.has(childProjectId)) {
        continue
      }

      visitedDescendantIds.add(childProjectId)
      visibleIds.add(childProjectId)
      queue.push(childProjectId)
    }
  }

  return visibleIds
}

function redactProjectNames(projects: ProjectRecord[], visibleIds: Set<string>): ProjectRecord[] {
  return projects.map((project) =>
    visibleIds.has(project.id)
      ? project
      : {
          ...project,
          name: 'XXX',
        },
  )
}

export async function listProjects(db: D1DatabaseLike) {
  return listProjectRows(db)
}

export async function listAllProjectsPublic(db: D1DatabaseLike, options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly === true
  const result = await db
    .prepare(
      `SELECT id, created_at, updated_at, name, description, parent_project_id, owner, telegram_group_id, status
       FROM projects
       ${activeOnly ? "WHERE status = 'active'" : ''}
       ORDER BY created_at DESC`,
    )
    .bind()
    .all<ProjectRow>()

  return result.results.map(mapProjectRow).map((project) => ({
    ...toPublicProjectRecord(project),
    status: project.status,
  }))
}

export async function listProjectsForMember(db: D1DatabaseLike, membershipNumber: string) {
  const projects = await listProjects(db)
  const directVisibleIds = await getDirectVisibleProjectIds(db, membershipNumber)
  const visibleIds = getVisibleProjectIds(projects, directVisibleIds)

  return projects
    .filter((project) => visibleIds.has(project.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((project) => ({
        ...toPublicProjectRecord(project),
        status: project.status,
      }))
}

export async function listDirectProjectsForMember(
  db: D1DatabaseLike,
  membershipNumber: string,
  options?: { activeOnly?: boolean },
) {
  const normalizedMembershipNumber = membershipNumber.trim()
  const activeOnly = options?.activeOnly === true

  const result = await db
    .prepare(
      `SELECT id, created_at, updated_at, name, description, parent_project_id, owner, telegram_group_id, status
       FROM projects
       WHERE (owner = ?
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = projects.id
              AND pm.membership_number = ?
          ))
         ${activeOnly ? "AND status = 'active'" : ''}
       ORDER BY created_at DESC`,
    )
    .bind(normalizedMembershipNumber, normalizedMembershipNumber)
    .all<ProjectRow>()

  return result.results.map(mapProjectRow).map((project) => ({
      ...toPublicProjectRecord(project),
      status: project.status,
  }))
}

export async function listProjectsForMemberWithRedactedNames(
  db: D1DatabaseLike,
  membershipNumber: string,
  options?: { activeOnly?: boolean },
) {
  const projects = await listProjects(db)
  const directVisibleIds = await getDirectVisibleProjectIds(db, membershipNumber)
  const visibleIds = getVisibleProjectIds(projects, directVisibleIds)
  const activeOnly = options?.activeOnly === true

  return redactProjectNames(projects, visibleIds)
    .filter((project) => !activeOnly || project.status === 'active')
    .map((project) => ({
      ...toPublicProjectRecord(project),
      status: project.status,
    }))
}

export async function getProjectById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare('SELECT id, created_at, updated_at, name, description, parent_project_id, owner, telegram_group_id, status FROM projects WHERE id = ?')
    .bind(id)
    .first<ProjectRow>()

  if (!row) {
    return null
  }

  const project = mapProjectRow(row)
  return {
    ...project,
    skills: await getAssociatedSkills(db, 'project', project.id),
  }
}

export async function getProjectByIdForMember(db: D1DatabaseLike, id: string, membershipNumber: string) {
  const projects = await listProjects(db)
  const directVisibleIds = await getDirectVisibleProjectIds(db, membershipNumber)
  const visibleIds = getVisibleProjectIds(projects, directVisibleIds)

  return projects.find((project) => project.id === id && visibleIds.has(project.id)) ?? null
}

export async function getDirectProjectByIdForMember(db: D1DatabaseLike, id: string, membershipNumber: string) {
  const project = await getProjectById(db, id)

  if (!project) {
    return null
  }

  const directVisibleIds = await getDirectVisibleProjectIds(db, membershipNumber)
  return directVisibleIds.has(project.id) ? project : null
}

export async function createProject(db: D1DatabaseLike, id: string, input: CreateProjectInput) {
  await db
    .prepare(
      'INSERT INTO projects (id, name, description, parent_project_id, owner, telegram_group_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      input.name,
      input.description ?? null,
      input.parentProjectId ?? null,
      input.owner,
      input.telegramGroupId ?? null,
      input.status,
    )
    .run()

  await replaceAssociatedSkills(db, 'project', id, input.skills ?? null)

  return getProjectById(db, id)
}

export async function updateProjectById(db: D1DatabaseLike, id: string, input: UpdateProjectInput) {
  const updates: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }

  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }

  if (input.parentProjectId !== undefined) {
    updates.push('parent_project_id = ?')
    values.push(input.parentProjectId)
  }

  if (input.owner !== undefined) {
    updates.push('owner = ?')
    values.push(input.owner)
  }

  if (input.telegramGroupId !== undefined) {
    updates.push('telegram_group_id = ?')
    values.push(input.telegramGroupId)
  }

  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }

  if (updates.length === 0) {
    return getProjectById(db, id)
  }

  updates.push("updated_at = datetime('now')")

  await db
    .prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run()

  if (input.skills !== undefined) {
    await replaceAssociatedSkills(db, 'project', id, input.skills ?? null)
  }

  return getProjectById(db, id)
}

export async function deleteProjectById(db: D1DatabaseLike, id: string) {
  const existing = await getProjectById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run()
  return true
}
