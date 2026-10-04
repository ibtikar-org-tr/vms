import { listSubtasksByTaskId } from '../repositories/vms-task-subtasks.repository'
import { listTasksByProjectId } from '../repositories/vms-tasks.repository'
import type { AppBindings } from '../types/bindings'
import { reindexTaskVectors } from './task-embeddings.service'

export interface ReindexProjectTasksResult {
  total: number
  indexed: number
  skipped: number
  failed: number
  errors: Array<{ taskId: string; message: string }>
}

/**
 * One-shot backfill: embed all tasks for a project (or every task if projectId omitted).
 */
export async function reindexAllProjectTasks(
  env: AppBindings,
  options?: { projectId?: string; limit?: number },
): Promise<ReindexProjectTasksResult> {
  const tasks = await listTasksByProjectId(env.VMS_DB, options?.projectId)
  const limited = typeof options?.limit === 'number' ? tasks.slice(0, options.limit) : tasks

  const result: ReindexProjectTasksResult = {
    total: limited.length,
    indexed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  for (const task of limited) {
    try {
      const subtasks = await listSubtasksByTaskId(env.VMS_DB, task.id)
      const reindex = await reindexTaskVectors(env, {
        projectId: task.projectId,
        taskId: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        points: task.points,
        subtasks: subtasks.map((subtask) => ({ name: subtask.name, status: subtask.status })),
      })

      if (reindex.skipped) {
        result.skipped += 1
      } else {
        result.indexed += 1
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({
        taskId: task.id,
        message: error instanceof Error ? error.message : 'Unknown reindex error',
      })
      console.warn(`Backfill reindex failed for task ${task.id}`, error)
    }
  }

  return result
}
