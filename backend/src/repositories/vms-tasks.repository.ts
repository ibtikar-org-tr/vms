import type { CreateTaskInput, UpdateTaskInput } from '../schemas/vms-task.schema'
import type { D1DatabaseLike } from '../types/bindings'
import { getAssociatedSkills, replaceAssociatedSkills } from './skills-association.repository'

interface TaskRow {
  id: string
  created_at: string
  updated_at: string
  project_id: string
  name: string
  description: string | null
  created_by: string
  status: string
  priority: string | null
  due_date: string | null
  points: number
  assigned_to: string | null
  completed_by: string | null
  completed_at: string | null
  approved_by: string | null
  last_reminded_at: string | null
}

function mapTaskRow(row: TaskRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    status: row.status,
    priority: row.priority ?? 'medium',
    dueDate: row.due_date,
    points: row.points,
    assignedTo: row.assigned_to,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    approvedBy: row.approved_by,
    lastRemindedAt: row.last_reminded_at,
    skills: null,
  }
}

async function hydrateTaskRow(db: D1DatabaseLike, row: TaskRow) {
  const task = mapTaskRow(row)
  return {
    ...task,
    skills: await getAssociatedSkills(db, 'task', task.id),
  }
}

export async function listTasks(db: D1DatabaseLike, options?: { statuses?: string[] }) {
  const statuses = options?.statuses?.filter((status) => status.trim().length > 0)

  if (statuses && statuses.length > 0) {
    const placeholders = statuses.map(() => '?').join(', ')
    const result = await db
      .prepare(
        `SELECT id, created_at, updated_at, project_id, name, description, created_by, status, priority, due_date, points, assigned_to, completed_by, completed_at, approved_by, last_reminded_at FROM tasks WHERE status IN (${placeholders}) ORDER BY created_at DESC`,
      )
      .bind(...statuses)
      .all<TaskRow>()

    return Promise.all(result.results.map((row) => hydrateTaskRow(db, row)))
  }

  const result = await db
    .prepare(
      'SELECT id, created_at, updated_at, project_id, name, description, created_by, status, priority, due_date, points, assigned_to, completed_by, completed_at, approved_by, last_reminded_at FROM tasks ORDER BY created_at DESC',
    )
    .bind()
    .all<TaskRow>()

  return Promise.all(result.results.map((row) => hydrateTaskRow(db, row)))
}

export async function listTasksByProjectId(db: D1DatabaseLike, projectId?: string) {
  if (projectId?.trim()) {
    const result = await db
      .prepare(
        'SELECT id, created_at, updated_at, project_id, name, description, created_by, status, priority, due_date, points, assigned_to, completed_by, completed_at, approved_by, last_reminded_at FROM tasks WHERE project_id = ? ORDER BY created_at DESC',
      )
      .bind(projectId.trim())
      .all<TaskRow>()

    return Promise.all(result.results.map((row) => hydrateTaskRow(db, row)))
  }

  return listTasks(db)
}

export async function getTaskById(db: D1DatabaseLike, id: string) {
  const row = await db
    .prepare(
      'SELECT id, created_at, updated_at, project_id, name, description, created_by, status, priority, due_date, points, assigned_to, completed_by, completed_at, approved_by, last_reminded_at FROM tasks WHERE id = ?',
    )
    .bind(id)
    .first<TaskRow>()

  return row ? hydrateTaskRow(db, row) : null
}

export async function createTask(db: D1DatabaseLike, id: string, input: CreateTaskInput) {
  await db
    .prepare(
      'INSERT INTO tasks (id, project_id, name, description, created_by, status, priority, due_date, points, assigned_to, completed_by, completed_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      input.projectId,
      input.name,
      input.description ?? null,
      input.createdBy,
      input.status,
      input.priority,
      input.dueDate ?? null,
      input.points ?? 1,
      input.assignedTo ?? null,
      input.completedBy ?? null,
      input.completedAt ?? null,
      input.approvedBy ?? null,
    )
    .run()

  await replaceAssociatedSkills(db, 'task', id, input.skills ?? null)

  return getTaskById(db, id)
}

export async function updateTaskById(db: D1DatabaseLike, id: string, input: UpdateTaskInput) {
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
    values.push(input.description)
  }

  if (input.createdBy !== undefined) {
    updates.push('created_by = ?')
    values.push(input.createdBy)
  }

  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }

  if (input.priority !== undefined) {
    updates.push('priority = ?')
    values.push(input.priority)
  }

  if (input.dueDate !== undefined) {
    updates.push('due_date = ?')
    values.push(input.dueDate)
  }

  if (input.points !== undefined) {
    updates.push('points = ?')
    values.push(input.points)
  }

  if (input.assignedTo !== undefined) {
    updates.push('assigned_to = ?')
    values.push(input.assignedTo)
  }

  if (input.completedBy !== undefined) {
    updates.push('completed_by = ?')
    values.push(input.completedBy)
  }

  if (input.completedAt !== undefined) {
    updates.push('completed_at = ?')
    values.push(input.completedAt)
  }

  if (input.approvedBy !== undefined) {
    updates.push('approved_by = ?')
    values.push(input.approvedBy)
  }

  if (updates.length === 0) {
    return getTaskById(db, id)
  }

  updates.push("updated_at = datetime('now')")

  await db
    .prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run()

  if (input.skills !== undefined) {
    await replaceAssociatedSkills(db, 'task', id, input.skills ?? null)
  }

  return getTaskById(db, id)
}

export async function updateTaskLastRemindedAt(db: D1DatabaseLike, id: string, remindedAt: string) {
  await db
    .prepare("UPDATE tasks SET last_reminded_at = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(remindedAt, id)
    .run()

  return getTaskById(db, id)
}

export async function deleteTaskById(db: D1DatabaseLike, id: string) {
  const existing = await getTaskById(db, id)

  if (!existing) {
    return false
  }

  await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return true
}
