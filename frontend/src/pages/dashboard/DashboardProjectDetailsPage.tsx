import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import {
  createTask,
  createTaskSubtask,
  deleteTaskSubtask,
  fetchProjectMemberContact,
  fetchProjectById,
  fetchProjectMembers,
  fetchTaskSubtasks,
  fetchTasks,
  generateTaskWithAi,
  leaveProject,
  remindTask,
  removeProjectMember,
  requestTelegramGroupInvite,
  updateProject,
  updateProjectMemberRole,
  updateTask,
  updateTaskSubtask,
} from '../../api/vms'
import type { VmsProject, VmsProjectMember, VmsTask, VmsTaskSubtask } from '../../types/vms'
import { getStoredUser } from '../../utils/auth'
import {
  AddTaskModal,
  LeaveProjectConfirmModal,
  MembersModal,
  ProjectSettingsModal,
  RemoveProjectMemberConfirmModal,
} from '../../components/dashboard/project-details/ProjectDetailsModals'
import { MemberInfoModal } from '../../components/dashboard/project-details/MemberInfoModal'
import { TaskDetailsModal } from '../../components/dashboard/project-details/TaskDetailsModal'
import { AiAddTaskModal, type AiGeneratedTaskDraft } from '../../components/dashboard/project-details/AiAddTaskModal'
import { ProjectHeader } from '../../components/dashboard/project-details/ProjectHeader'
import { TaskBoard, type TaskBoardStatus } from '../../components/dashboard/project-details/TaskBoard'
import { UnallowedAccessPage } from './UnallowedAccessPage'

function isOptimisticSubtaskId(subtaskId: string) {
  return subtaskId.startsWith('optimistic-')
}

type TaskFieldUpdatePayload = {
  name?: string
  description?: string
  status?: 'open' | 'in_progress' | 'completed' | 'archived'
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  points?: number
  assignedTo?: string
  skills?: Record<string, string>
}

function applyOptimisticTaskPatch(task: VmsTask, patch: TaskFieldUpdatePayload, membershipNumber: string): VmsTask {
  const next: VmsTask = {
    ...task,
    subtaskProgress: task.subtaskProgress ?? null,
    updatedAt: new Date().toISOString(),
  }

  if (patch.name !== undefined) {
    next.name = patch.name
  }

  if (patch.description !== undefined) {
    next.description = patch.description ?? null
  }

  if (patch.status !== undefined) {
    next.status = patch.status
    if (patch.status === 'completed' && task.status !== 'completed') {
      next.completedBy = membershipNumber
      next.completedAt = new Date().toISOString()
    } else if (patch.status !== 'completed' && task.status === 'completed') {
      next.completedBy = null
      next.completedAt = null
      next.approvedBy = null
    }
  }

  if (patch.priority !== undefined) {
    next.priority = patch.priority
  }

  if (patch.points !== undefined) {
    next.points = patch.points
  }

  if (patch.dueDate !== undefined) {
    next.dueDate = patch.dueDate
  }

  if (patch.assignedTo !== undefined) {
    next.assignedTo = patch.assignedTo || null
  }

  if (patch.skills !== undefined) {
    next.skills = patch.skills
  }

  return next
}

function revertOptimisticTaskPatch(task: VmsTask, snapshot: VmsTask, patch: TaskFieldUpdatePayload): VmsTask {
  const next: VmsTask = {
    ...task,
    subtaskProgress: task.subtaskProgress ?? snapshot.subtaskProgress ?? null,
  }

  if (patch.name !== undefined) {
    next.name = snapshot.name
  }

  if (patch.description !== undefined) {
    next.description = snapshot.description
  }

  if (patch.status !== undefined) {
    next.status = snapshot.status
    next.completedBy = snapshot.completedBy
    next.completedAt = snapshot.completedAt
    next.approvedBy = snapshot.approvedBy
  }

  if (patch.priority !== undefined) {
    next.priority = snapshot.priority
  }

  if (patch.points !== undefined) {
    next.points = snapshot.points
  }

  if (patch.dueDate !== undefined) {
    next.dueDate = snapshot.dueDate
  }

  if (patch.assignedTo !== undefined) {
    next.assignedTo = snapshot.assignedTo
  }

  if (patch.skills !== undefined) {
    next.skills = snapshot.skills
  }

  return next
}

export function DashboardProjectDetailsPage() {
  const { projectID } = useParams()
  const navigate = useNavigate()
  const user = useMemo(() => getStoredUser(), [])
  const [project, setProject] = useState<VmsProject | null>(null)
  const [parentProjectName, setParentProjectName] = useState<string | null>(null)
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null)
  const [projectTasks, setProjectTasks] = useState<VmsTask[]>([])
  const [projectMembers, setProjectMembers] = useState<VmsProjectMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isAiAddTaskOpen, setIsAiAddTaskOpen] = useState(false)
  const [isGeneratingAiTask, setIsGeneratingAiTask] = useState(false)
  const [isCreatingAiTask, setIsCreatingAiTask] = useState(false)
  const [aiTaskGenerateError, setAiTaskGenerateError] = useState<string | null>(null)
  const [aiTaskCreateError, setAiTaskCreateError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isRemindingTask, setIsRemindingTask] = useState(false)
  const [taskUpdateError, setTaskUpdateError] = useState<string | null>(null)
  const [taskRemindError, setTaskRemindError] = useState<string | null>(null)
  const [taskRemindSuccess, setTaskRemindSuccess] = useState<string | null>(null)
  const [selectedTaskSubtasks, setSelectedTaskSubtasks] = useState<VmsTaskSubtask[]>([])
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false)
  const [subtaskError, setSubtaskError] = useState<string | null>(null)
  const pendingSubtaskCreatesRef = useRef<Map<string, Promise<VmsTaskSubtask>>>(new Map())
  const cancelledOptimisticSubtasksRef = useRef<Set<string>>(new Set())
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [memberInfoTarget, setMemberInfoTarget] = useState<VmsProjectMember | null>(null)
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false)
  const [isLeavingProject, setIsLeavingProject] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<VmsProjectMember | null>(null)
  const [isRemovingMember, setIsRemovingMember] = useState(false)
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(null)
  const [removingMembershipNumber, setRemovingMembershipNumber] = useState<string | null>(null)
  const [updatingRoleMembershipNumber, setUpdatingRoleMembershipNumber] = useState<string | null>(null)
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null)
  const [telegramInviteError, setTelegramInviteError] = useState<string | null>(null)
  const [telegramInviteSuccess, setTelegramInviteSuccess] = useState<string | null>(null)
  const [isSendingTelegramInvite, setIsSendingTelegramInvite] = useState(false)

  useEffect(() => {
    if (!projectID || !user) {
      return
    }

    const currentProjectId = projectID
    const currentUser = user
    const controller = new AbortController()

    async function loadProjectData() {
      try {
        const [projectPayload, tasksPayload, membersPayload] = await Promise.all([
          fetchProjectById(currentProjectId, currentUser.membershipNumber),
          fetchTasks(currentUser.membershipNumber),
          fetchProjectMembers(currentProjectId),
        ])

        if (controller.signal.aborted) {
          return
        }

        setProject(projectPayload.project)
        setProjectTasks(tasksPayload.tasks.filter((task) => task.projectId === currentProjectId))
        setProjectMembers(membersPayload.projectMembers)
      } catch {
        if (!controller.signal.aborted) {
          setNotFound(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadProjectData()

    return () => {
      controller.abort()
    }
  }, [projectID, user])

  useEffect(() => {
    if (!project?.parentProjectId) {
      setParentProjectName(null)
      return
    }

    const parentId = project.parentProjectId
    let isActive = true

    async function loadParentProjectName() {
      try {
        const payload = await fetchProjectById(parentId, user?.membershipNumber)
        if (!isActive) {
          return
        }

        setParentProjectName(payload.project.name)
      } catch {
        if (isActive) {
          setParentProjectName(null)
        }
      }
    }

    loadParentProjectName()

    return () => {
      isActive = false
    }
  }, [project?.parentProjectId])

  useEffect(() => {
    if (!project?.owner || !project.id) {
      setOwnerDisplayName(null)
      return
    }

    const ownerMembershipNumber = project.owner
    const currentProjectId = project.id
    let isActive = true

    async function loadOwnerDisplayName() {
      try {
        const payload = await fetchProjectMemberContact(currentProjectId, ownerMembershipNumber)
        if (!isActive) {
          return
        }

        const displayName =
          payload.contact.arName?.trim() ||
          payload.contact.enName?.trim() ||
          payload.contact.membershipNumber

        setOwnerDisplayName(displayName)
      } catch {
        if (isActive) {
          setOwnerDisplayName(null)
        }
      }
    }

    loadOwnerDisplayName()

    return () => {
      isActive = false
    }
  }, [project?.id, project?.owner])

  const memberOptions = useMemo(() => projectMembers, [projectMembers])
  const memberNameByMembership = useMemo(
    () => new Map(projectMembers.map((member) => [member.membershipNumber, member.displayName])),
    [projectMembers],
  )
  const memberCount = projectMembers.length
  const previewMembers = useMemo(() => projectMembers.slice(0, 4), [projectMembers])
  const hiddenMembersCount = Math.max(0, projectMembers.length - previewMembers.length)

  const boardColumns = useMemo(
    (): Array<{ key: TaskBoardStatus; label: string; items: VmsTask[] }> => [
      { key: 'open', label: 'مفتوحة', items: projectTasks.filter((task) => task.status === 'open') },
      { key: 'in_progress', label: 'قيد التنفيذ', items: projectTasks.filter((task) => task.status === 'in_progress') },
      { key: 'completed', label: 'مكتملة', items: projectTasks.filter((task) => task.status === 'completed') },
      { key: 'archived', label: 'مؤرشفة', items: projectTasks.filter((task) => task.status === 'archived') },
    ],
    [projectTasks],
  )

  const selectedTask = useMemo(
    () => (selectedTaskId ? projectTasks.find((task) => task.id === selectedTaskId) ?? null : null),
    [projectTasks, selectedTaskId],
  )

  const projectManagerMembershipNumbers = useMemo(
    () => new Set(projectMembers.filter((member) => member.role === 'manager').map((member) => member.membershipNumber)),
    [projectMembers],
  )
  const canManageProjectMembers = useMemo(() => {
    if (!project || !user) {
      return false
    }

    const currentMembershipNumber = user.membershipNumber
    return project.owner === currentMembershipNumber || projectManagerMembershipNumbers.has(currentMembershipNumber)
  }, [project, projectManagerMembershipNumbers, user])
  const isProjectOwner = useMemo(() => {
    if (!project || !user) {
      return false
    }

    return project.owner === user.membershipNumber
  }, [project, user])
  const isProjectMember = useMemo(() => {
    if (!user) {
      return false
    }

    if (project?.owner === user.membershipNumber) {
      return true
    }

    return projectMembers.some((member) => member.membershipNumber === user.membershipNumber)
  }, [project?.owner, projectMembers, user])
  const canLeaveProject = isProjectMember && !isProjectOwner
  const ownershipTransferOptions = useMemo(
    () =>
      projectMembers.filter(
        (member) => member.role !== 'owner' && member.membershipNumber !== project?.owner,
      ),
    [projectMembers, project?.owner],
  )
  const canManageProject = canManageProjectMembers
  const canCreateTask = useMemo(() => {
    if (!project || !user) {
      return false
    }

    if (project.owner === user.membershipNumber) {
      return true
    }

    return projectMembers.some((member) => member.membershipNumber === user.membershipNumber)
  }, [project, projectMembers, user])

  const canEditTask = useCallback(
    (task: VmsTask) => {
      if (!project || !user) {
        return false
      }

      const currentMembershipNumber = user.membershipNumber
      return (
        task.assignedTo === currentMembershipNumber ||
        project.owner === currentMembershipNumber ||
        projectManagerMembershipNumbers.has(currentMembershipNumber)
      )
    },
    [project, projectManagerMembershipNumbers, user],
  )

  const canEditSelectedTask = useMemo(() => {
    if (!selectedTask) {
      return false
    }

    return canEditTask(selectedTask)
  }, [canEditTask, selectedTask])

  const canRemindSelectedTask = useMemo(() => {
    if (!selectedTask || !canManageProjectMembers) {
      return false
    }

    const assignee = selectedTask.assignedTo?.trim()
    if (!assignee) {
      return false
    }

    return selectedTask.status === 'open' || selectedTask.status === 'in_progress'
  }, [canManageProjectMembers, selectedTask])

  const formatAssignee = (membershipNumber: string | null) => {
    if (!membershipNumber) {
      return 'غير مسند'
    }

    return memberNameByMembership.get(membershipNumber) ?? membershipNumber
  }

  useEffect(() => {
    setTaskRemindError(null)
    setTaskRemindSuccess(null)
    setSubtaskError(null)
  }, [selectedTaskId])

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTaskSubtasks([])
      setIsLoadingSubtasks(false)
      return
    }

    const currentTaskId = selectedTaskId
    const controller = new AbortController()

    async function loadSubtasks() {
      setIsLoadingSubtasks(true)
      setSubtaskError(null)

      try {
        const payload = await fetchTaskSubtasks(currentTaskId)
        if (!controller.signal.aborted) {
          setSelectedTaskSubtasks((current) => (current.length === 0 ? payload.subtasks : current))
        }
      } catch {
        if (!controller.signal.aborted) {
          setSelectedTaskSubtasks([])
          setSubtaskError('تعذر تحميل المهام الفرعية.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSubtasks(false)
        }
      }
    }

    void loadSubtasks()

    return () => {
      controller.abort()
    }
  }, [selectedTaskId])

  function subtaskProgressFromList(subtasks: VmsTaskSubtask[]) {
    if (subtasks.length === 0) {
      return null
    }

    return {
      completed: subtasks.filter((subtask) => subtask.status === 'completed').length,
      total: subtasks.length,
    }
  }

  function syncParentSubtaskProgress(taskId: string, subtasks: VmsTaskSubtask[]) {
    const progress = subtaskProgressFromList(subtasks)
    setProjectTasks((previous) =>
      previous.map((task) => (task.id === taskId ? { ...task, subtaskProgress: progress } : task)),
    )
  }

  function buildOptimisticSubtask(parentTaskId: string, name: string, tempId: string): VmsTaskSubtask {
    const now = new Date().toISOString()
    return {
      id: tempId,
      parentTaskId,
      name,
      status: 'open',
      completedAt: null,
      completedBy: null,
      sortOrder: Number.MAX_SAFE_INTEGER,
      createdAt: now,
      updatedAt: now,
    }
  }

  async function resolveSubtaskServerId(subtaskId: string) {
    if (!isOptimisticSubtaskId(subtaskId)) {
      return subtaskId
    }

    const pendingCreate = pendingSubtaskCreatesRef.current.get(subtaskId)
    if (!pendingCreate) {
      throw new Error('Subtask not found.')
    }

    const serverSubtask = await pendingCreate
    return serverSubtask.id
  }

  function replaceOptimisticSubtask(taskId: string, tempId: string, serverSubtask: VmsTaskSubtask) {
    setSelectedTaskSubtasks((current) => {
      const optimistic = current.find((subtask) => subtask.id === tempId)
      const mergedSubtask =
        optimistic && optimistic.status !== serverSubtask.status
          ? ({
              ...serverSubtask,
              status: optimistic.status,
              completedAt: optimistic.completedAt,
              completedBy: optimistic.completedBy,
            } as VmsTaskSubtask)
          : serverSubtask

      const nextSubtasks = current.map((subtask) => (subtask.id === tempId ? mergedSubtask : subtask))
      syncParentSubtaskProgress(taskId, nextSubtasks)
      return nextSubtasks
    })

    return serverSubtask
  }

  const closeTaskDetails = () => {
    setTaskUpdateError(null)
    setTaskRemindError(null)
    setTaskRemindSuccess(null)
    setSubtaskError(null)
    pendingSubtaskCreatesRef.current.clear()
    cancelledOptimisticSubtasksRef.current.clear()
    setSelectedTaskSubtasks([])
    setSelectedTaskId(null)
  }

  const handleRemindTask = async () => {
    setTaskRemindError(null)
    setTaskRemindSuccess(null)

    if (!selectedTask || !user?.membershipNumber || !canRemindSelectedTask) {
      return
    }

    setIsRemindingTask(true)

    try {
      const payload = await remindTask(selectedTask.id, user.membershipNumber)
      setProjectTasks((previous) =>
        previous.map((task) =>
          task.id === payload.task.id
            ? { ...payload.task, subtaskProgress: task.subtaskProgress ?? null }
            : task,
        ),
      )
      setTaskRemindSuccess('تم إرسال التذكير إلى المكلّف عبر تيليجرام.')
    } catch (requestError) {
      if (requestError instanceof Error) {
        setTaskRemindError(requestError.message)
      } else {
        setTaskRemindError('تعذر إرسال التذكير.')
      }
    } finally {
      setIsRemindingTask(false)
    }
  }

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaveError(null)

    if (!projectID || !project || !user) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const transferOwnerTo = String(formData.get('transferOwnerTo') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const telegramGroupId = String(formData.get('telegramGroupId') ?? '').trim()
    const statusRaw = String(formData.get('status') ?? project.status).trim()
    const status = statusRaw === 'completed' || statusRaw === 'archived' ? statusRaw : 'active'
    const skillsRaw = String(formData.get('skills') ?? '').trim()
    let skills
    if (skillsRaw) {
      try {
        const parsed = JSON.parse(skillsRaw)
        skills = typeof parsed === 'object' && parsed !== null ? parsed : undefined
      } catch {
        skills = Object.fromEntries(
          skillsRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => [item, 'required']),
        )
      }
    }

    if (!name) {
      setSaveError('يرجى إدخال اسم المشروع.')
      return
    }

    setIsSaving(true)

    try {
      const payload = await updateProject(projectID, {
        name,
        ...(transferOwnerTo ? { owner: transferOwnerTo } : {}),
        ...(description ? { description } : {}),
        ...(telegramGroupId ? { telegramGroupId } : {}),
        status,
        ...(skills ? { skills } : {}),
      }, user.membershipNumber)
      setProject(payload.project)
      const membersPayload = await fetchProjectMembers(projectID)
      setProjectMembers(membersPayload.projectMembers)
      setIsProjectSettingsOpen(false)
    } catch (requestError) {
      if (requestError instanceof Error) {
        setSaveError(requestError.message)
      } else {
        setSaveError('تعذر تحديث المشروع.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTaskError(null)
    const form = event.currentTarget

    if (!projectID) {
      return
    }

    if (!user) {
      setTaskError('يجب تسجيل الدخول لإضافة مهمة.')
      return
    }

    if (!canCreateTask) {
      setTaskError('إضافة المهام متاحة فقط لأعضاء المشروع المباشرين.')
      return
    }

    const formData = new FormData(form)
    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const statusRaw = String(formData.get('status') ?? 'open').trim()
    const status =
      statusRaw === 'in_progress' || statusRaw === 'completed' || statusRaw === 'archived' ? statusRaw : 'open'
    const priorityRaw = String(formData.get('priority') ?? 'medium').trim()
    const priority =
      priorityRaw === 'high' || priorityRaw === 'low' || priorityRaw === 'medium' ? priorityRaw : 'medium'
    const dueDateRaw = String(formData.get('dueDate') ?? '').trim()
    const pointsRawValue = String(formData.get('points') ?? '').trim()
    const pointsRaw = pointsRawValue === '' ? 1 : Number(pointsRawValue)
    const assignedTo = String(formData.get('assignedTo') ?? '').trim()
    const skillsRaw = String(formData.get('skills') ?? '').trim()
    const skills = skillsRaw
      ? Object.fromEntries(
          skillsRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => [item, 'required']),
        )
      : undefined

    if (!name) {
      setTaskError('يرجى إدخال اسم المهمة.')
      return
    }

    if (Number.isNaN(pointsRaw) || pointsRaw < 1) {
      setTaskError('يجب أن تكون النقاط 1 على الأقل.')
      return
    }

    setIsCreatingTask(true)

    const currentUser = user

    try {
      const payload = await createTask({
        projectId: projectID,
        name,
        description: description || undefined,
        createdBy: currentUser.membershipNumber,
        status,
        priority,
        dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
        points: Math.max(1, Math.trunc(pointsRaw)),
        assignedTo: assignedTo || undefined,
        ...(skills ? { skills } : {}),
      }, currentUser.membershipNumber)

      setProjectTasks((previous) => [{ ...payload.task, subtaskProgress: null }, ...previous])
      form.reset()
      setIsAddTaskOpen(false)
    } catch (requestError) {
      if (requestError instanceof Error) {
        setTaskError(requestError.message)
      } else {
        setTaskError('تعذر إنشاء المهمة.')
      }
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleGenerateAiTask = async (
    prompt: string,
    model: string,
  ): Promise<AiGeneratedTaskDraft | null> => {
    setAiTaskGenerateError(null)

    if (!projectID || !user) {
      setAiTaskGenerateError('يجب تسجيل الدخول لإنشاء مهمة.')
      return null
    }

    if (!canCreateTask) {
      setAiTaskGenerateError('إضافة المهام متاحة فقط لأعضاء المشروع المباشرين.')
      return null
    }

    setIsGeneratingAiTask(true)

    try {
      const payload = await generateTaskWithAi({
        projectId: projectID,
        prompt,
        model,
      })

      return {
        name: payload.generated.name,
        description: payload.generated.description ?? '',
        priority: payload.generated.priority,
        subtasks: payload.generated.subtasks ?? [],
      }
    } catch (requestError) {
      if (requestError instanceof Error) {
        setAiTaskGenerateError(requestError.message)
      } else {
        setAiTaskGenerateError('تعذر توليد المهمة بالذكاء الاصطناعي.')
      }
      return null
    } finally {
      setIsGeneratingAiTask(false)
    }
  }

  const handleCreateAiTask = async (
    draft: AiGeneratedTaskDraft & { assignedTo?: string; points: number },
  ) => {
    setAiTaskCreateError(null)

    if (!projectID || !user) {
      setAiTaskCreateError('يجب تسجيل الدخول لإنشاء مهمة.')
      return
    }

    if (!canCreateTask) {
      setAiTaskCreateError('إضافة المهام متاحة فقط لأعضاء المشروع المباشرين.')
      return
    }

    setIsCreatingAiTask(true)
    const currentUser = user

    try {
      const payload = await createTask(
        {
          projectId: projectID,
          name: draft.name,
          description: draft.description || undefined,
          createdBy: currentUser.membershipNumber,
          status: 'open',
          priority: draft.priority,
          points: draft.points,
          assignedTo: draft.assignedTo,
        },
        currentUser.membershipNumber,
      )

      const subtaskNames = draft.subtasks.map((item) => item.trim()).filter(Boolean)
      await Promise.all(
        subtaskNames.map((name) => createTaskSubtask(payload.task.id, { name })),
      )

      setProjectTasks((previous) => [
        {
          ...payload.task,
          subtaskProgress:
            subtaskNames.length > 0
              ? {
                  total: subtaskNames.length,
                  completed: 0,
                }
              : null,
        },
        ...previous,
      ])
      setIsAiAddTaskOpen(false)
      setAiTaskGenerateError(null)
      setAiTaskCreateError(null)
    } catch (requestError) {
      if (requestError instanceof Error) {
        setAiTaskCreateError(requestError.message)
      } else {
        setAiTaskCreateError('تعذر إنشاء المهمة.')
      }
    } finally {
      setIsCreatingAiTask(false)
    }
  }


  const handleUpdateTask = async (patch: TaskFieldUpdatePayload) => {
    if (!selectedTask) {
      return
    }

    await updateProjectTask(selectedTask.id, patch)
  }

  const updateProjectTask = async (taskId: string, patch: TaskFieldUpdatePayload) => {
    setTaskUpdateError(null)

    const task = projectTasks.find((entry) => entry.id === taskId)
    if (!task || !canEditTask(task) || !user) {
      setTaskUpdateError('لا يمكن تحديث المهمة في الوقت الحالي.')
      return
    }

    const payload: TaskFieldUpdatePayload = {}

    if (patch.name !== undefined) {
      const nextName = patch.name.trim()
      if (!nextName) {
        setTaskUpdateError('يرجى إدخال اسم المهمة.')
        return
      }
      payload.name = nextName
    }

    if (patch.description !== undefined) {
      payload.description = patch.description.trim() || undefined
    }

    if (patch.status !== undefined) {
      payload.status = patch.status
    }

    if (patch.priority !== undefined) {
      payload.priority = patch.priority
    }

    if (patch.points !== undefined) {
      if (Number.isNaN(patch.points) || patch.points < 1) {
        setTaskUpdateError('يجب أن تكون النقاط 1 على الأقل.')
        return
      }

      payload.points = Math.max(1, Math.trunc(patch.points))
    }

    if (patch.dueDate !== undefined) {
      payload.dueDate = patch.dueDate
    }

    if (patch.assignedTo !== undefined) {
      payload.assignedTo = patch.assignedTo
    }

    if (patch.skills !== undefined) {
      payload.skills = patch.skills
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    const membershipNumber = user.membershipNumber
    let snapshot: VmsTask | null = null

    setProjectTasks((current) => {
      const existing = current.find((entry) => entry.id === taskId)
      if (!existing) {
        return current
      }

      snapshot = existing
      return current.map((entry) =>
        entry.id === taskId ? applyOptimisticTaskPatch(entry, payload, membershipNumber) : entry,
      )
    })

    if (!snapshot) {
      return
    }

    const rollbackSnapshot = snapshot

    try {
      const response = await updateTask(taskId, payload, membershipNumber)

      setProjectTasks((current) =>
        current.map((entry) =>
          entry.id === response.task.id
            ? { ...response.task, subtaskProgress: entry.subtaskProgress ?? null }
            : entry,
        ),
      )
    } catch (requestError) {
      setProjectTasks((current) =>
        current.map((entry) =>
          entry.id === taskId ? revertOptimisticTaskPatch(entry, rollbackSnapshot, payload) : entry,
        ),
      )

      if (requestError instanceof Error) {
        setTaskUpdateError(requestError.message)
      } else {
        setTaskUpdateError('تعذر تحديث المهمة.')
      }
    }
  }

  const handleMoveTask = (taskId: string, status: TaskFieldUpdatePayload['status']) => {
    if (!status) {
      return
    }

    const task = projectTasks.find((entry) => entry.id === taskId)
    if (!task || task.status === status) {
      return
    }

    void updateProjectTask(taskId, { status })
  }

  const handleCreateSubtask = async (name: string) => {
    if (!selectedTask || !canEditSelectedTask) {
      return
    }

    const taskId = selectedTask.id
    const tempId = `optimistic-${crypto.randomUUID()}`
    const optimisticSubtask = buildOptimisticSubtask(taskId, name, tempId)
    let previousSubtasks: VmsTaskSubtask[] = []

    setSubtaskError(null)
    setSelectedTaskSubtasks((current) => {
      previousSubtasks = current
      const nextSubtasks = [...current, optimisticSubtask]
      syncParentSubtaskProgress(taskId, nextSubtasks)
      return nextSubtasks
    })

    const createPromise = createTaskSubtask(taskId, { name })
      .then((response) => {
        if (cancelledOptimisticSubtasksRef.current.has(tempId)) {
          cancelledOptimisticSubtasksRef.current.delete(tempId)
          void deleteTaskSubtask(taskId, response.subtask.id)
          return response.subtask
        }

        replaceOptimisticSubtask(taskId, tempId, response.subtask)
        return response.subtask
      })
      .finally(() => {
        pendingSubtaskCreatesRef.current.delete(tempId)
      })

    pendingSubtaskCreatesRef.current.set(tempId, createPromise)

    try {
      await createPromise
    } catch (requestError) {
      if (cancelledOptimisticSubtasksRef.current.has(tempId)) {
        cancelledOptimisticSubtasksRef.current.delete(tempId)
        return
      }

      setSelectedTaskSubtasks(previousSubtasks)
      syncParentSubtaskProgress(taskId, previousSubtasks)
      if (requestError instanceof Error) {
        setSubtaskError(requestError.message)
      } else {
        setSubtaskError('تعذر إضافة المهمة الفرعية.')
      }
    }
  }

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (!selectedTask || !canEditSelectedTask) {
      return
    }

    const taskId = selectedTask.id
    let previousSubtasks: VmsTaskSubtask[] = []

    setSubtaskError(null)
    setSelectedTaskSubtasks((current) => {
      previousSubtasks = current
      const nextSubtasks = current.map((subtask) => {
        if (subtask.id !== subtaskId) {
          return subtask
        }

        return {
          ...subtask,
          status: completed ? 'completed' : 'open',
          completedAt: completed ? new Date().toISOString() : null,
          completedBy: completed ? user?.membershipNumber ?? null : null,
        } as VmsTaskSubtask
      })
      syncParentSubtaskProgress(taskId, nextSubtasks)
      return nextSubtasks
    })

    try {
      const resolvedId = await resolveSubtaskServerId(subtaskId)
      const response = await updateTaskSubtask(taskId, resolvedId, {
        status: completed ? 'completed' : 'open',
      })
      setSelectedTaskSubtasks((current) => {
        const nextSubtasks = current.map((subtask) =>
          subtask.id === subtaskId || subtask.id === resolvedId ? response.subtask : subtask,
        )
        syncParentSubtaskProgress(taskId, nextSubtasks)
        return nextSubtasks
      })
    } catch (requestError) {
      setSelectedTaskSubtasks(previousSubtasks)
      syncParentSubtaskProgress(taskId, previousSubtasks)
      if (requestError instanceof Error) {
        setSubtaskError(requestError.message)
      } else {
        setSubtaskError('تعذر تحديث المهمة الفرعية.')
      }
    }
  }

  const handleRenameSubtask = async (subtaskId: string, name: string) => {
    if (!selectedTask || !canEditSelectedTask) {
      return
    }

    const taskId = selectedTask.id
    let previousSubtasks: VmsTaskSubtask[] = []

    setSubtaskError(null)
    setSelectedTaskSubtasks((current) => {
      previousSubtasks = current
      const nextSubtasks = current.map((subtask) => (subtask.id === subtaskId ? { ...subtask, name } : subtask))
      return nextSubtasks
    })

    try {
      const resolvedId = await resolveSubtaskServerId(subtaskId)
      const response = await updateTaskSubtask(taskId, resolvedId, { name })
      setSelectedTaskSubtasks((current) =>
        current.map((subtask) =>
          subtask.id === subtaskId || subtask.id === resolvedId ? response.subtask : subtask,
        ),
      )
    } catch (requestError) {
      setSelectedTaskSubtasks(previousSubtasks)
      if (requestError instanceof Error) {
        setSubtaskError(requestError.message)
      } else {
        setSubtaskError('تعذر إعادة تسمية المهمة الفرعية.')
      }
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!selectedTask || !canEditSelectedTask) {
      return
    }

    const taskId = selectedTask.id
    let previousSubtasks: VmsTaskSubtask[] = []

    setSubtaskError(null)
    setSelectedTaskSubtasks((current) => {
      previousSubtasks = current
      const nextSubtasks = current.filter((subtask) => subtask.id !== subtaskId)
      syncParentSubtaskProgress(taskId, nextSubtasks)
      return nextSubtasks
    })

    if (isOptimisticSubtaskId(subtaskId)) {
      cancelledOptimisticSubtasksRef.current.add(subtaskId)
      const pendingCreate = pendingSubtaskCreatesRef.current.get(subtaskId)
      if (pendingCreate) {
        void pendingCreate
          .then((serverSubtask) => {
            if (!cancelledOptimisticSubtasksRef.current.has(subtaskId)) {
              return
            }

            cancelledOptimisticSubtasksRef.current.delete(subtaskId)
            return deleteTaskSubtask(taskId, serverSubtask.id)
          })
          .catch(() => {
            cancelledOptimisticSubtasksRef.current.delete(subtaskId)
          })
      }
      return
    }

    try {
      await deleteTaskSubtask(taskId, subtaskId)
    } catch (requestError) {
      setSelectedTaskSubtasks(previousSubtasks)
      syncParentSubtaskProgress(taskId, previousSubtasks)
      if (requestError instanceof Error) {
        setSubtaskError(requestError.message)
      } else {
        setSubtaskError('تعذر حذف المهمة الفرعية.')
      }
    }
  }

  const handleRemoveProjectMember = async () => {
    setRemoveMemberError(null)

    if (!projectID || !user || !memberPendingRemoval) {
      return
    }

    const targetMembershipNumber = memberPendingRemoval.membershipNumber
    setIsRemovingMember(true)
    setRemovingMembershipNumber(targetMembershipNumber)

    try {
      await removeProjectMember(projectID, targetMembershipNumber, user.membershipNumber)
      const membersPayload = await fetchProjectMembers(projectID)
      setProjectMembers(membersPayload.projectMembers)
      setMemberPendingRemoval(null)
    } catch (requestError) {
      if (requestError instanceof Error) {
        setRemoveMemberError(requestError.message)
      } else {
        setRemoveMemberError('تعذر إزالة العضو من المشروع.')
      }
    } finally {
      setIsRemovingMember(false)
      setRemovingMembershipNumber(null)
    }
  }

  const handleChangeMemberRole = async (member: VmsProjectMember, role: 'member' | 'manager') => {
    setRoleUpdateError(null)

    if (!projectID || !user || !isProjectOwner) {
      return
    }

    setUpdatingRoleMembershipNumber(member.membershipNumber)

    try {
      const response = await updateProjectMemberRole(projectID, member.membershipNumber, role)
      setProjectMembers((previous) =>
        previous.map((item) =>
          item.membershipNumber === response.projectMember.membershipNumber ? response.projectMember : item,
        ),
      )
    } catch (requestError) {
      if (requestError instanceof Error) {
        setRoleUpdateError(requestError.message)
      } else {
        setRoleUpdateError('تعذر تحديث دور العضو.')
      }
    } finally {
      setUpdatingRoleMembershipNumber(null)
    }
  }

  const handleLeaveProject = async () => {
    setLeaveError(null)

    if (!projectID || !user) {
      return
    }

    setIsLeavingProject(true)

    try {
      await leaveProject(projectID, user.membershipNumber)
      navigate('/projects', { replace: true })
    } catch (requestError) {
      if (requestError instanceof Error) {
        setLeaveError(requestError.message)
      } else {
        setLeaveError('تعذر مغادرة المشروع.')
      }
    } finally {
      setIsLeavingProject(false)
    }
  }

  const handleSendTelegramInvite = async () => {
    setTelegramInviteError(null)
    setTelegramInviteSuccess(null)

    if (!project?.telegramGroupId || !user?.membershipNumber) {
      return
    }

    setIsSendingTelegramInvite(true)
    try {
      await requestTelegramGroupInvite(user.membershipNumber, {
        resourceType: 'project',
        resourceId: project.id,
      })
      setTelegramInviteSuccess('تم إرسال دعوة مجموعة التلغرام عبر البوت.')
    } catch (requestError) {
      if (requestError instanceof Error) {
        setTelegramInviteError(requestError.message)
      } else {
        setTelegramInviteError('تعذر إرسال دعوة مجموعة التلغرام.')
      }
    } finally {
      setIsSendingTelegramInvite(false)
    }
  }

  if (!projectID) {
    return <Navigate to="/projects" replace />
  }

  if (notFound) {
    return <UnallowedAccessPage />
  }

  if (isLoading || !project) {
    return (
      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-slate-500">جار تحميل تفاصيل المشروع...</p>
      </section>
    )
  }

  const telegramInviteFeedback = telegramInviteError ?? telegramInviteSuccess

  return (
    <section className="w-full space-y-3">
      <ProjectHeader
        project={project}
        parentProjectName={parentProjectName}
        ownerDisplayName={ownerDisplayName}
        ownerFallbackName={formatAssignee(project.owner)}
        memberCount={memberCount}
        projectMembers={projectMembers}
        previewMembers={previewMembers}
        hiddenMembersCount={hiddenMembersCount}
        canCreateTask={canCreateTask}
        canManageProject={canManageProject}
        onOpenAddTask={() => setIsAddTaskOpen(true)}
        onOpenAiAddTask={() => {
          setAiTaskGenerateError(null)
          setAiTaskCreateError(null)
          setIsAiAddTaskOpen(true)
        }}
        eventsPath={`/projects/${project.id}/events`}
        clubsPath={`/projects/${project.id}/clubs`}
        positionsPath={`/projects/${project.id}/positions`}
        notesPath={`/projects/${project.id}/notes`}
        subProjectsPath={`/projects/${project.id}/sub-projects`}
        onOpenMembers={() => setIsMembersOpen(true)}
        onOpenProjectSettings={() => setIsProjectSettingsOpen(true)}
        showTelegramInvite={Boolean(project.telegramGroupId)}
        isSendingTelegramInvite={isSendingTelegramInvite}
        onSendTelegramInvite={() => void handleSendTelegramInvite()}
        telegramInviteFeedback={telegramInviteFeedback}
        telegramInviteFeedbackIsError={Boolean(telegramInviteError)}
        canLeaveProject={canLeaveProject}
        onLeaveProject={() => {
          setLeaveError(null)
          setIsLeaveConfirmOpen(true)
        }}
      >
        {taskUpdateError ? <p className="mb-2 text-sm text-red-600">{taskUpdateError}</p> : null}
        <TaskBoard
          boardColumns={boardColumns}
          onOpenTask={(taskId) => setSelectedTaskId(taskId)}
          onMoveTask={handleMoveTask}
          canMoveTask={canEditTask}
          formatAssignee={formatAssignee}
        />
      </ProjectHeader>

      {selectedTask ? (
        <TaskDetailsModal
          selectedTask={selectedTask}
          canEditSelectedTask={canEditSelectedTask}
          canRemindTask={canRemindSelectedTask}
          isRemindingTask={isRemindingTask}
          taskUpdateError={taskUpdateError}
          taskRemindError={taskRemindError}
          taskRemindSuccess={taskRemindSuccess}
          memberOptions={memberOptions}
          formatAssignee={formatAssignee}
          subtasks={selectedTaskSubtasks}
          isLoadingSubtasks={isLoadingSubtasks}
          subtaskLoadingPlaceholderCount={selectedTask.subtaskProgress?.total ?? 0}
          subtaskError={subtaskError}
          onClose={closeTaskDetails}
          onUpdateTask={handleUpdateTask}
          onRemindTask={handleRemindTask}
          onCreateSubtask={handleCreateSubtask}
          onToggleSubtask={handleToggleSubtask}
          onRenameSubtask={handleRenameSubtask}
          onDeleteSubtask={handleDeleteSubtask}
        />
      ) : null}

      {isProjectSettingsOpen ? (
        <ProjectSettingsModal
          project={project}
          isProjectOwner={isProjectOwner}
          ownershipTransferOptions={ownershipTransferOptions}
          isSaving={isSaving}
          saveError={saveError}
          onClose={() => setIsProjectSettingsOpen(false)}
          onSubmit={handleUpdateProject}
        />
      ) : null}

      {isAddTaskOpen ? (
        <AddTaskModal
          isCreatingTask={isCreatingTask}
          taskError={taskError}
          memberOptions={memberOptions}
          onClose={() => setIsAddTaskOpen(false)}
          onSubmit={handleCreateTask}
        />
      ) : null}

      {isAiAddTaskOpen ? (
        <AiAddTaskModal
          isGenerating={isGeneratingAiTask}
          isCreating={isCreatingAiTask}
          generateError={aiTaskGenerateError}
          createError={aiTaskCreateError}
          memberOptions={memberOptions}
          onClose={() => {
            if (!isGeneratingAiTask && !isCreatingAiTask) {
              setIsAiAddTaskOpen(false)
              setAiTaskGenerateError(null)
              setAiTaskCreateError(null)
            }
          }}
          onGenerate={handleGenerateAiTask}
          onCreate={handleCreateAiTask}
        />
      ) : null}

      {isMembersOpen ? (
        <MembersModal
          projectMembers={projectMembers}
          projectOwnerMembershipNumber={project.owner}
          actorMembershipNumber={user?.membershipNumber ?? null}
          canManageMembers={canManageProjectMembers}
          isProjectOwner={isProjectOwner}
          removingMembershipNumber={removingMembershipNumber}
          updatingRoleMembershipNumber={updatingRoleMembershipNumber}
          roleUpdateError={roleUpdateError}
          onSelectMember={(member) => setMemberInfoTarget(member)}
          onRequestRemove={(member) => {
            setRemoveMemberError(null)
            setMemberPendingRemoval(member)
          }}
          onChangeMemberRole={(member, role) => void handleChangeMemberRole(member, role)}
          onClose={() => {
            if (!isRemovingMember && !updatingRoleMembershipNumber) {
              setIsMembersOpen(false)
              setMemberPendingRemoval(null)
              setRemoveMemberError(null)
              setRoleUpdateError(null)
            }
          }}
        />
      ) : null}

      {memberInfoTarget ? (
        <MemberInfoModal
          projectId={project.id}
          membershipNumber={memberInfoTarget.membershipNumber}
          displayName={memberInfoTarget.displayName}
          onClose={() => setMemberInfoTarget(null)}
        />
      ) : null}

      {memberPendingRemoval ? (
        <RemoveProjectMemberConfirmModal
          memberDisplayName={memberPendingRemoval.displayName}
          membershipNumber={memberPendingRemoval.membershipNumber}
          isRemoving={isRemovingMember}
          removeError={removeMemberError}
          onClose={() => {
            if (!isRemovingMember) {
              setMemberPendingRemoval(null)
              setRemoveMemberError(null)
            }
          }}
          onConfirm={() => void handleRemoveProjectMember()}
        />
      ) : null}

      {isLeaveConfirmOpen ? (
        <LeaveProjectConfirmModal
          projectName={project.name}
          isLeaving={isLeavingProject}
          leaveError={leaveError}
          onClose={() => {
            if (!isLeavingProject) {
              setIsLeaveConfirmOpen(false)
              setLeaveError(null)
            }
          }}
          onConfirm={() => void handleLeaveProject()}
        />
      ) : null}
    </section>
  )
}
