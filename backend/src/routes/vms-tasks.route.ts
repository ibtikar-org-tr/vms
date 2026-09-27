import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getDirectProjectByIdForMember, listDirectProjectsForMember } from '../repositories/vms-projects.repository'
import {
  attachSubtaskProgress,
  createSubtask,
  deleteSubtaskById,
  getSubtaskById,
  getSubtaskProgressByTaskIds,
  listSubtasksByTaskId,
  updateSubtaskById,
} from '../repositories/vms-task-subtasks.repository'
import {
  createTask,
  deleteTaskById,
  getTaskById,
  listTasks,
  updateTaskById,
  updateTaskLastRemindedAt,
} from '../repositories/vms-tasks.repository'
import { getUserProfileByMembershipNumber } from '../repositories/user-info.repository'
import {
  createTaskSubtaskSchema,
  taskSubtaskParamsSchema,
  updateTaskSubtaskSchema,
} from '../schemas/vms-task-subtask.schema'
import { generateTaskWithAiSchema } from '../schemas/vms-ai-task.schema'
import { createTaskSchema, taskParamsSchema, updateTaskSchema } from '../schemas/vms-task.schema'
import { generateTaskFromPrompt } from '../services/ai-task-generation.service'
import { notifyAssignedTask, notifyTaskReminder } from '../services/task-assignment-notification.service'
import { deleteTaskVectors, reindexTaskVectors } from '../services/task-embeddings.service'
import { syncTaskCompletionPoints, type TaskPointsState } from '../services/task-points.service'

import type { AppBindings } from '../types/bindings'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { canManageProject, getProjectAccess } from '../utils/project-access'

async function queueTaskVectorReindex(
  env: AppBindings,
  task: {
    id: string
    projectId: string
    name: string
    description: string | null
    status: string
    priority: string
    assignedTo: string | null
    dueDate: string | null
    points: number
  },
) {
  try {
    const subtasks = await listSubtasksByTaskId(env.VMS_DB, task.id)
    await reindexTaskVectors(env, {
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
  } catch (error) {
    console.warn(`Failed to reindex task vectors for ${task.id}`, error)
  }
}

function toPointsState(task: {
  id: string
  status: string
  points: number
  assignedTo: string | null
  completedBy: string | null
  approvedBy: string | null
}): TaskPointsState {
  return {
    id: task.id,
    status: task.status,
    points: task.points,
    assignedTo: task.assignedTo,
    completedBy: task.completedBy,
    approvedBy: task.approvedBy,
  }
}

export const vmsTasksRoute = new Hono<AppEnv>()

async function canManageProjectTasks(db: AppBindings['VMS_DB'], projectId: string, membershipNumber: string) {
  return canManageProject(db, projectId, membershipNumber)
}

async function canEditTask(
  db: AppBindings['VMS_DB'],
  task: { projectId: string; assignedTo: string | null },
  membershipNumber: string,
) {
  const access = await getProjectAccess(db, task.projectId, membershipNumber)

  if (!access.project) {
    return false
  }

  if (access.canManage) {
    return true
  }

  return task.assignedTo === membershipNumber
}

async function enrichTasksWithSubtaskProgress(db: AppBindings['VMS_DB'], tasks: Awaited<ReturnType<typeof listTasks>>) {
  const progressMap = await getSubtaskProgressByTaskIds(
    db,
    tasks.map((task) => task.id),
  )
  return attachSubtaskProgress(tasks, progressMap)
}

vmsTasksRoute.get('/tasks', async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const statusesParam = c.req.query('status')
    const statuses = statusesParam
      ? statusesParam
          .split(',')
          .map((status) => status.trim())
          .filter(Boolean)
      : undefined

    const directProjects = await listDirectProjectsForMember(c.env.VMS_DB, membershipNumber)
    const directProjectIds = new Set(directProjects.map((project) => project.id))
    const tasks = await listTasks(c.env.VMS_DB, statuses ? { statuses } : undefined)
    const visibleTasks = tasks.filter((task) => directProjectIds.has(task.projectId))
    const enrichedTasks = await enrichTasksWithSubtaskProgress(c.env.VMS_DB, visibleTasks)
    return c.json({ tasks: enrichedTasks })
  } catch (error) {
    console.error('Failed to list tasks', error)
    return c.json({ error: 'Could not fetch tasks.' }, 500)
  }
})

vmsTasksRoute.get('/tasks/:id', zValidator('param', taskParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)


    const task = await getTaskById(c.env.VMS_DB, id)

    if (!task) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)
    if (!project) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const [enrichedTask] = await enrichTasksWithSubtaskProgress(c.env.VMS_DB, [task])
    return c.json({ task: enrichedTask })
  } catch (error) {
    console.error('Failed to fetch task', error)
    return c.json({ error: 'Could not fetch task.' }, 500)
  }
})

vmsTasksRoute.post('/tasks/ai-generate', zValidator('json', generateTaskWithAiSchema), async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const payload = c.req.valid('json')

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, payload.projectId, membershipNumber)
    if (!project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    const generated = await generateTaskFromPrompt(c.env, payload.prompt, {
      projectId: project.id,
      projectName: project.name,
      projectDescription: project.description,
      model: payload.model,
    })

    return c.json({ generated })
  } catch (error) {
    console.error('Failed to generate task with AI', error)
    if (error instanceof Error && error.message.trim()) {
      return c.json({ error: error.message }, 502)
    }
    return c.json({ error: 'تعذر توليد المهمة بالذكاء الاصطناعي.' }, 502)
  }
})

vmsTasksRoute.post('/tasks', zValidator('json', createTaskSchema), async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)


    const payload = c.req.valid('json')
    if (payload.createdBy.trim() !== membershipNumber) {
      return c.json({ error: 'Created by must match your membership number.' }, 403)
    }

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, payload.projectId, membershipNumber)
    if (!project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    const projectOwnerProfile = await getUserProfileByMembershipNumber(c.env.MEMBERS_DB, project.owner)

    const taskId = crypto.randomUUID()
    const task = await createTask(c.env.VMS_DB, taskId, payload)

    if (!task) {
      return c.json({ error: 'Could not create task.' }, 500)
    }

    try {
      await syncTaskCompletionPoints(c.env.MEMBERS_DB, c.env.VMS_DB, null, toPointsState(task))
    } catch (pointsError) {
      console.error('Failed to sync task completion points on create', pointsError)
    }

    if (payload.assignedTo?.trim()) {
      await notifyAssignedTask(c.env, {
        assignedTo: payload.assignedTo,
        projectId: project.id,
        projectName: project.name,
        taskName: task.name,
        projectOwnerTelegramId: projectOwnerProfile?.telegramId,
        projectOwnerTelegramUsername: projectOwnerProfile?.telegramUsername,
        dueDate: task.dueDate,
        description: task.description,
        priority: task.priority,
        points: task.points,
      })
    }

    await queueTaskVectorReindex(c.env, task)

    return c.json({ task }, 201)
  } catch (error) {
    console.error('Failed to create task', error)
    return c.json({ error: 'Could not create task.' }, 500)
  }
})

vmsTasksRoute.put(
  '/tasks/:id',
  zValidator('param', taskParamsSchema),
  zValidator('json', updateTaskSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)


      const payload = c.req.valid('json')

      const existing = await getTaskById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const project = await getDirectProjectByIdForMember(c.env.VMS_DB, existing.projectId, membershipNumber)
      if (!project) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const projectOwnerProfile = await getUserProfileByMembershipNumber(c.env.MEMBERS_DB, project.owner)

      // Auto-stamp the completion audit columns when status is being flipped to 'completed'.
      // Keeps `completed_by` / `completed_at` meaningful even when the UI only sends `{ status }`.
      if (payload.status === 'completed' && existing.status !== 'completed') {
        if (payload.completedBy === undefined && !existing.completedBy) {
          payload.completedBy = membershipNumber
        }
        if (payload.completedAt === undefined && !existing.completedAt) {
          payload.completedAt = new Date().toISOString()
        }
      }

      const task = await updateTaskById(c.env.VMS_DB, id, payload)

      if (!task) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      try {
        await syncTaskCompletionPoints(
          c.env.MEMBERS_DB,
          c.env.VMS_DB,
          toPointsState(existing),
          toPointsState(task),
        )
      } catch (pointsError) {
        console.error('Failed to sync task completion points on update', pointsError)
      }

      const newAssignee = payload.assignedTo?.trim()
      const currentAssignee = existing.assignedTo?.trim()
      if (newAssignee && newAssignee !== currentAssignee) {
        await notifyAssignedTask(c.env, {
          assignedTo: newAssignee,
          projectId: project.id,
          projectName: project.name,
          taskName: task.name,
          projectOwnerTelegramId: projectOwnerProfile?.telegramId,
          projectOwnerTelegramUsername: projectOwnerProfile?.telegramUsername,
          dueDate: task.dueDate,
          description: task.description,
          priority: task.priority,
          points: task.points,
        })
      }

      await queueTaskVectorReindex(c.env, task)

      return c.json({ task })
    } catch (error) {
      console.error('Failed to update task', error)
      return c.json({ error: 'Could not update task.' }, 500)
    }
  },
)

vmsTasksRoute.post('/tasks/:id/remind', zValidator('param', taskParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)


    const task = await getTaskById(c.env.VMS_DB, id)

    if (!task) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)

    if (!project) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const authorization = await canManageProjectTasks(c.env.VMS_DB, task.projectId, membershipNumber)

    if (!authorization.isAuthorized) {
      return c.json({ error: 'فقط مالك المشروع أو المدراء يمكنهم إرسال تذكير للمهمة.' }, 403)
    }

    const assignee = task.assignedTo?.trim()

    if (!assignee) {
      return c.json({ error: 'لا يمكن إرسال تذكير لمهمة غير مسندة.' }, 400)
    }

    if (task.status !== 'open' && task.status !== 'in_progress') {
      return c.json({ error: 'يمكن إرسال التذكير للمهام المفتوحة أو قيد التنفيذ فقط.' }, 400)
    }

    const projectOwnerProfile = await getUserProfileByMembershipNumber(c.env.MEMBERS_DB, project.owner)

    const notification = await notifyTaskReminder(c.env, {
      assignedTo: assignee,
      projectId: project.id,
      projectName: project.name,
      taskName: task.name,
      projectOwnerTelegramId: projectOwnerProfile?.telegramId,
      projectOwnerTelegramUsername: projectOwnerProfile?.telegramUsername,
      dueDate: task.dueDate,
      description: task.description,
      priority: task.priority,
      points: task.points,
    })

    if (!notification.success) {
      return c.json({ error: 'تعذر إرسال التذكير عبر تيليجرام.' }, 502)
    }

    const remindedAt = new Date().toISOString()
    const updatedTask = await updateTaskLastRemindedAt(c.env.VMS_DB, id, remindedAt)

    if (!updatedTask) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    return c.json({ task: updatedTask, remindedAt })
  } catch (error) {
    console.error('Failed to send task reminder', error)
    return c.json({ error: 'Could not send task reminder.' }, 500)
  }
})

vmsTasksRoute.delete('/tasks/:id', zValidator('param', taskParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)


    const existing = await getTaskById(c.env.VMS_DB, id)
    if (!existing) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, existing.projectId, membershipNumber)
    if (!project) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const deleted = await deleteTaskById(c.env.VMS_DB, id)

    if (!deleted) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    try {
      await deleteTaskVectors(c.env, id)
    } catch (error) {
      console.warn(`Failed to delete task vectors for ${id}`, error)
    }

    return c.json({ message: 'Task deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete task', error)
    return c.json({ error: 'Could not delete task.' }, 500)
  }
})

vmsTasksRoute.get('/tasks/:id/subtasks', zValidator('param', taskParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)

    const task = await getTaskById(c.env.VMS_DB, id)
    if (!task) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)
    if (!project) {
      return c.json({ error: 'Task not found.' }, 404)
    }

    const subtasks = await listSubtasksByTaskId(c.env.VMS_DB, id)
    return c.json({ subtasks })
  } catch (error) {
    console.error('Failed to list task subtasks', error)
    return c.json({ error: 'Could not fetch task subtasks.' }, 500)
  }
})

vmsTasksRoute.post(
  '/tasks/:id/subtasks',
  zValidator('param', taskParamsSchema),
  zValidator('json', createTaskSubtaskSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)
      const payload = c.req.valid('json')

      const task = await getTaskById(c.env.VMS_DB, id)
      if (!task) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)
      if (!project) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const canEdit = await canEditTask(c.env.VMS_DB, task, membershipNumber)
      if (!canEdit) {
        return c.json({ error: 'لا يمكنك تعديل مهام فرعية لهذه المهمة.' }, 403)
      }

      const subtaskId = crypto.randomUUID()
      const subtask = await createSubtask(c.env.VMS_DB, subtaskId, id, payload)
      await queueTaskVectorReindex(c.env, task)
      return c.json({ subtask }, 201)
    } catch (error) {
      console.error('Failed to create task subtask', error)
      return c.json({ error: 'Could not create task subtask.' }, 500)
    }
  },
)

vmsTasksRoute.put(
  '/tasks/:id/subtasks/:subtaskId',
  zValidator('param', taskSubtaskParamsSchema),
  zValidator('json', updateTaskSubtaskSchema),
  async (c) => {
    try {
      const { id, subtaskId } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)
      const payload = c.req.valid('json')

      const task = await getTaskById(c.env.VMS_DB, id)
      if (!task) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)
      if (!project) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const existingSubtask = await getSubtaskById(c.env.VMS_DB, subtaskId)
      if (!existingSubtask || existingSubtask.parentTaskId !== id) {
        return c.json({ error: 'Subtask not found.' }, 404)
      }

      const canEdit = await canEditTask(c.env.VMS_DB, task, membershipNumber)
      if (!canEdit) {
        return c.json({ error: 'لا يمكنك تعديل مهام فرعية لهذه المهمة.' }, 403)
      }

      const subtask = await updateSubtaskById(c.env.VMS_DB, subtaskId, payload, membershipNumber)
      if (!subtask) {
        return c.json({ error: 'Subtask not found.' }, 404)
      }

      await queueTaskVectorReindex(c.env, task)
      return c.json({ subtask })
    } catch (error) {
      console.error('Failed to update task subtask', error)
      return c.json({ error: 'Could not update task subtask.' }, 500)
    }
  },
)

vmsTasksRoute.delete(
  '/tasks/:id/subtasks/:subtaskId',
  zValidator('param', taskSubtaskParamsSchema),
  async (c) => {
    try {
      const { id, subtaskId } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)

      const task = await getTaskById(c.env.VMS_DB, id)
      if (!task) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const project = await getDirectProjectByIdForMember(c.env.VMS_DB, task.projectId, membershipNumber)
      if (!project) {
        return c.json({ error: 'Task not found.' }, 404)
      }

      const existingSubtask = await getSubtaskById(c.env.VMS_DB, subtaskId)
      if (!existingSubtask || existingSubtask.parentTaskId !== id) {
        return c.json({ error: 'Subtask not found.' }, 404)
      }

      const canEdit = await canEditTask(c.env.VMS_DB, task, membershipNumber)
      if (!canEdit) {
        return c.json({ error: 'لا يمكنك حذف مهام فرعية لهذه المهمة.' }, 403)
      }

      const deleted = await deleteSubtaskById(c.env.VMS_DB, subtaskId)
      if (!deleted) {
        return c.json({ error: 'Subtask not found.' }, 404)
      }

      await queueTaskVectorReindex(c.env, task)
      return c.json({ message: 'Subtask deleted successfully.' })
    } catch (error) {
      console.error('Failed to delete task subtask', error)
      return c.json({ error: 'Could not delete task subtask.' }, 500)
    }
  },
)
