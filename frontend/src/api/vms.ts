import type {
  VmsClub,
  VmsClubDashboard,
  VmsClubMember,
  VmsEvent,
  VmsEventRegistration,
  VmsEventTicket,
  VmsLeaderboardEntry,
  VmsLeaderboardViewer,
  VmsPointTransaction,
  VmsPosition,
  VmsPositionApplication,
  VmsProject,
  VmsProjectMember,
  VmsProjectMemberContact,
  VmsProjectNote,
  VmsSkill,
  VmsTask,
  VmsTaskSubtask,
} from '../types/vms'
import type {
  ForgotPasswordResponse,
  LoginResponse,
  ResetPasswordResponse,
  ResetPasswordStatusResponse,
  ChangePasswordResponse,
} from '../types/auth'
import type { MemberProfile } from '../types/profile'

import { API_BASE, apiDelete, apiFetch, apiGetJson, apiPostJson, apiPutJson, fetchPublicJson, logoutRequest } from './client'
import { TelegramActivationRequiredError } from '../utils/login-errors'

const GET_CACHE_TTL_MS = 1500
const inFlightGetRequests = new Map<string, Promise<unknown>>()
const recentGetResponses = new Map<string, { expiresAt: number; data: unknown }>()

async function fetchJson<T>(path: string): Promise<T> {
  const requestKey = path
  const now = Date.now()
  const cached = recentGetResponses.get(requestKey)
  if (cached && cached.expiresAt > now) return cached.data as T
  const inFlight = inFlightGetRequests.get(requestKey)
  if (inFlight) return inFlight as Promise<T>
  const requestPromise = (async () => {
    const payload = await apiGetJson<T>(path)
    recentGetResponses.set(requestKey, { data: payload, expiresAt: Date.now() + GET_CACHE_TTL_MS })
    return payload
  })()
  inFlightGetRequests.set(requestKey, requestPromise)
  try { return await requestPromise } finally { inFlightGetRequests.delete(requestKey) }
}

async function postJson<TResponse, TPayload>(path: string, payload: TPayload, options?: { auth?: boolean }): Promise<TResponse> {
  return apiPostJson<TResponse, TPayload>(path, payload, options)
}

async function putJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  return apiPutJson<TResponse, TPayload>(path, payload)
}

async function deleteJson(path: string): Promise<void> {
  return apiDelete(path)
}

export async function login(payload: { identifier: string; password: string }): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    try {
      const body = (await response.json()) as { error?: unknown; code?: unknown }
      if (body.code === 'TELEGRAM_BOT_REQUIRED') {
        const message =
          typeof body.error === 'string' && body.error.trim()
            ? body.error
            : 'يجب تفعيل بوت تيليغرام قبل تسجيل الدخول.'
        throw new TelegramActivationRequiredError(message)
      }
      if (typeof body.error === 'string' && body.error.trim()) {
        throw new Error(body.error)
      }
    } catch (parseError) {
      if (parseError instanceof TelegramActivationRequiredError || parseError instanceof Error) {
        throw parseError
      }
    }

    throw new Error(`Request failed (${response.status})`)
  }

  return (await response.json()) as LoginResponse
}

export function logout() {
  return logoutRequest()
}

export function forgotPassword(payload: { type: 'email' | 'phone' | 'membership_number'; value: string }) {
  return postJson<ForgotPasswordResponse, { type: 'email' | 'phone' | 'membership_number'; value: string }>(
    '/forgot-password',
    payload,
  )
}

export function resetPassword(payload: { token: string; newPassword: string }) {
  return postJson<ResetPasswordResponse, { token: string; newPassword: string }>('/reset-password', payload, { auth: false })
}

export function fetchResetPasswordStatus(token: string) {
  const params = new URLSearchParams({ token })
  return fetchPublicJson<ResetPasswordStatusResponse>(`/reset-password/status?${params.toString()}`)
}

export function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return postJson<ChangePasswordResponse, { currentPassword: string; newPassword: string }>(
    '/change-password',
    payload,
  )
}

export function fetchProfile(membershipNumber: string) {
  return fetchJson<{ profile: MemberProfile }>(`/profile/${encodeURIComponent(membershipNumber)}`)
}

export function updateProfile(
  membershipNumber: string,
  payload: Partial<{
    enName: string
    arName: string
    phoneNumber: string
    sex: string
    dateOfBirth: string
    country: string
    region: string
    city: string
    address: string
    educationLevel: string
    school: string
    graduationYear: number
    fieldOfStudy: string
    bloodType: string
    socialMediaLinks: string
    biography: string
    interests: string
    skills: string
    languages: string
  }>,
) {
  return putJson<{ profile: MemberProfile }, typeof payload>(
    `/profile/${encodeURIComponent(membershipNumber)}`,
    payload,
  )
}

export function fetchProjects(membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  // Includes completed/archived; used by sub-projects pages that need inactive children.
  return fetchJson<{ projects: VmsProject[] }>(`/projects${query}`)
}

export function fetchDirectProjects(membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  // Main membership list; backend returns active projects only.
  return fetchJson<{ projects: VmsProject[] }>(`/projects/direct${query}`)
}

export function fetchPlatformProjects(membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  // Platform hierarchy for the main projects page; backend returns active projects only.
  return fetchJson<{ projects: VmsProject[] }>(`/projects/platform${query}`)
}

export function createProject(
  payload: {
    name: string
    description?: string
    parentProjectId?: string
    owner: string
    telegramGroupId?: string
    status: 'active' | 'completed' | 'archived'
    skills?: Record<string, string>
  },
  membershipNumber: string,
) {
  const query = ``
  return postJson<{ project: VmsProject }, typeof payload>(`/projects${query}`, payload)
}

export function fetchProjectById(projectId: string, membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  return fetchJson<{ project: VmsProject }>(`/projects/${encodeURIComponent(projectId)}${query}`)
}

export function updateProject(
  projectId: string,
  payload: Partial<{
    name: string
    description: string
    parentProjectId: string
    owner: string
    telegramGroupId: string
    status: 'active' | 'completed' | 'archived'
    skills: Record<string, string>
  }>,
  membershipNumber: string,
) {
  return putJson<{ project: VmsProject }, typeof payload>(
    `/projects/${encodeURIComponent(projectId)}`,
    payload,
  )
}

export function fetchTasks(
  membershipNumber: string,
  options?: {
    statuses?: Array<'open' | 'in_progress' | 'completed' | 'archived' | string>
  },
) {
  const params = new URLSearchParams()
  if (options?.statuses && options.statuses.length > 0) {
    params.set('status', options.statuses.join(','))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchJson<{ tasks: VmsTask[] }>(`/tasks${query}`)
}

export function fetchAgenda(options: {
  from: string
  to: string
  includeUnscheduled?: boolean
}) {
  const params = new URLSearchParams({
    from: options.from,
    to: options.to,
  })
  if (options.includeUnscheduled) {
    params.set('includeUnscheduled', '1')
  }

  return fetchJson<{
    from: string
    to: string
    tasks: Array<{
      id: string
      name: string
      status: string
      priority: string
      dueDate: string | null
      projectId: string
      projectName: string | null
    }>
    events: Array<{
      id: string
      name: string
      startTime: string | null
      endTime: string | null
      projectId: string | null
      projectName: string | null
    }>
    unscheduledTasks: Array<{
      id: string
      name: string
      status: string
      priority: string
      dueDate: string | null
      projectId: string
      projectName: string | null
    }>
  }>(`/agenda?${params.toString()}`)
}

export function createTask(payload: {
  projectId: string
  name: string
  description?: string
  createdBy: string
  status?: 'open' | 'in_progress' | 'completed' | 'archived'
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  points?: number
  assignedTo?: string
  skills?: Record<string, string>
}, membershipNumber: string) {
  return postJson<{ task: VmsTask }, typeof payload>(
    `/tasks`,
    payload,
  )
}

export function generateTaskWithAi(payload: { projectId: string; prompt: string }) {
  return postJson<
    {
      generated: {
        name: string
        description?: string
        priority: 'low' | 'medium' | 'high'
        subtasks: string[]
      }
    },
    typeof payload
  >(`/tasks/ai-generate`, payload)
}

export function remindTask(taskId: string, membershipNumber: string) {
  return postJson<{ task: VmsTask; remindedAt: string }, Record<string, never>>(
    `/tasks/${encodeURIComponent(taskId)}/remind`,
    {},
  )
}

export function updateTask(
  taskId: string,
  payload: Partial<{
    projectId: string
    name: string
    description: string
    createdBy: string
    status: 'open' | 'in_progress' | 'completed' | 'archived'
    priority: 'low' | 'medium' | 'high'
    dueDate: string
    points: number
    assignedTo: string
    completedBy: string
    completedAt: string
    approvedBy: string
    skills: Record<string, string>
  }>,
  membershipNumber: string,
) {
  return putJson<{ task: VmsTask }, typeof payload>(
    `/tasks/${encodeURIComponent(taskId)}`,
    payload,
  )
}

export function fetchTaskSubtasks(taskId: string) {
  return fetchJson<{ subtasks: VmsTaskSubtask[] }>(`/tasks/${encodeURIComponent(taskId)}/subtasks`)
}

export function createTaskSubtask(taskId: string, payload: { name: string }) {
  return postJson<{ subtask: VmsTaskSubtask }, typeof payload>(
    `/tasks/${encodeURIComponent(taskId)}/subtasks`,
    payload,
  )
}

export function updateTaskSubtask(
  taskId: string,
  subtaskId: string,
  payload: Partial<{ name: string; status: 'open' | 'completed' }>,
) {
  return putJson<{ subtask: VmsTaskSubtask }, typeof payload>(
    `/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
    payload,
  )
}

export function deleteTaskSubtask(taskId: string, subtaskId: string) {
  return deleteJson(`/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`)
}

export function fetchEvents() {
  return fetchJson<{ events: VmsEvent[] }>('/events')
}

export function createEvent(payload: {
  name: string
  description?: string
  startTime?: string
  endTime?: string
  status: 'draft' | 'public' | 'archived'
  createdBy: string
  projectId?: string
  skills?: Record<string, string>
  telegramGroupId?: string
  imageUrl?: string
  associatedUrls?: Record<string, unknown>
  displayAttendeeNumbers?: boolean
  cancellationDeadlineHours?: number
  allowGuestRegistration?: boolean
}) {
  return postJson<{ event: VmsEvent }, typeof payload>('/events', payload)
}

export function fetchEventById(eventId: string) {
  return fetchJson<{ event: VmsEvent }>(`/events/${encodeURIComponent(eventId)}`)
}

export function fetchPublicEventById(eventId: string) {
  return fetchPublicJson<{ event: VmsEvent }>(`/public/events/${encodeURIComponent(eventId)}`)
}

export function fetchPublicEventTickets(eventId: string) {
  return fetchPublicJson<{ eventTickets: VmsEventTicket[] }>(
    `/public/events/${encodeURIComponent(eventId)}/tickets`,
  )
}

export function updateEvent(
  eventId: string,
  payload: Partial<{
    name: string
    description: string
    startTime: string
    endTime: string
    status: 'draft' | 'public' | 'archived'
    createdBy: string
    projectId: string
    skills: Record<string, string>
    telegramGroupId: string
    imageUrl: string
    associatedUrls: Record<string, unknown>
    displayAttendeeNumbers: boolean
    cancellationDeadlineHours: number
    allowGuestRegistration: boolean
  }>,
) {
  return putJson<{ event: VmsEvent }, typeof payload>(`/events/${encodeURIComponent(eventId)}`, payload)
}

export function fetchEventTickets(eventId?: string) {
  const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
  return fetchJson<{ eventTickets: VmsEventTicket[] }>(`/event-tickets${query}`)
}

export function createEventTicket(payload: {
  eventId: string
  name: string
  description?: string
  pointPrice: number
  currencyPrice?: string
  quantity: number
}) {
  return postJson<{ eventTicket: VmsEventTicket }, typeof payload>('/event-tickets', payload)
}

export function updateEventTicket(
  ticketId: string,
  payload: Partial<{
    eventId: string
    name: string
    description: string
    pointPrice: number
    currencyPrice: string
    quantity: number
  }>,
) {
  return putJson<{ eventTicket: VmsEventTicket }, typeof payload>(`/event-tickets/${encodeURIComponent(ticketId)}`, payload)
}

export function deleteEventTicket(ticketId: string) {
  return deleteJson(`/event-tickets/${encodeURIComponent(ticketId)}`)
}

export function fetchEventRegistrationCounts(eventId: string) {
  return fetchJson<{ ticketCounts: Record<string, number>; total: number }>(
    `/events/${encodeURIComponent(eventId)}/registration-counts`,
  )
}

export function fetchEventRegistrations(
  eventId?: string,
  options?: {
    limit?: number
    offset?: number
    membershipNumber?: string
  },
) {
  const params = new URLSearchParams()
  if (eventId) {
    params.set('eventId', eventId)
  }
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit))
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset))
  }
  if (options?.membershipNumber) {
    params.set('membershipNumber', options.membershipNumber)
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchJson<{
    eventRegistrations: VmsEventRegistration[]
    total?: number
    hasMore?: boolean
  }>(`/event-registrations${query}`)
}

export function createPublicEventRegistration(
  eventId: string,
  payload: {
    ticketId: string
    guestName: string
    guestEmail: string
    guestPhone: string
  },
) {
  return postJson<{ eventRegistration: VmsEventRegistration }, typeof payload>(
    `/public/events/${encodeURIComponent(eventId)}/registrations`,
    payload,
    { auth: false },
  )
}

export function createEventRegistration(payload: {
  eventId: string
  membershipNumber: string
  ticketId: string
  status: 'registered' | 'attended' | 'cancelled' | 'no_show'
  paymentApprovedBy?: string
  attendanceApprovedBy?: string
}) {
  return postJson<{ eventRegistration: VmsEventRegistration }, typeof payload>('/event-registrations', payload)
}

export function updateEventRegistration(
  registrationId: string,
  payload: Partial<{
    eventId: string
    membershipNumber: string
    ticketId: string
    status: 'registered' | 'attended' | 'cancelled' | 'no_show'
    paymentApprovedBy: string
    attendanceApprovedBy: string
  }>,
) {
  return putJson<{ eventRegistration: VmsEventRegistration }, typeof payload>(
    `/event-registrations/${encodeURIComponent(registrationId)}`,
    payload,
  )
}

export function deleteEventRegistration(registrationId: string) {
  return deleteJson(`/event-registrations/${encodeURIComponent(registrationId)}`)
}

export function selfCancelEventRegistration(registrationId: string) {
  return postJson<{ message: string }, Record<string, never>>(
    `/event-registrations/${encodeURIComponent(registrationId)}/self-cancel`,
    {},
  )
}

export function changeEventRegistrationTicket(registrationId: string, ticketId: string) {
  return postJson<{ eventRegistration: VmsEventRegistration }, { ticketId: string }>(
    `/event-registrations/${encodeURIComponent(registrationId)}/change-ticket`,
    { ticketId },
  )
}

export function approveRegistration(registrationId: string, approverMembershipNumber: string, type: 'payment' | 'attendance') {
  return postJson<{ eventRegistration: VmsEventRegistration }, unknown>(
    `/event-registrations/${encodeURIComponent(registrationId)}/approve?type=${type}`,
    {},
  )
}

export function fetchSkills(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return fetchJson<{ skills: VmsSkill[] }>(`/skills${query}`)
}

export function searchOrCreateSkill(skillName: string) {
  return postJson<{ skill: VmsSkill }, { name: string }>('/skills/search-or-create', {
    name: skillName,
  })
}

export function fetchProjectMemberContact(projectId: string, targetMembershipNumber: string) {
  return fetchJson<{ contact: VmsProjectMemberContact }>(
    `/project-members/${encodeURIComponent(projectId)}/${encodeURIComponent(targetMembershipNumber)}/contact`,
  )
}

export function fetchEventRegistrantContact(eventId: string, targetMembershipNumber: string) {
  return fetchJson<{ contact: VmsProjectMemberContact }>(
    `/events/${encodeURIComponent(eventId)}/registrants/${encodeURIComponent(targetMembershipNumber)}/contact`,
  )
}

export function fetchProjectMembers(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
  return fetchJson<{ projectMembers: VmsProjectMember[] }>(`/project-members${query}`)
}

export function fetchProjectPositions(projectId: string, membershipNumber: string) {
  const query = `?projectId=${encodeURIComponent(projectId)}`
  return fetchJson<{ positions: VmsPosition[] }>(`/positions${query}`)
}

export function fetchOpenPositions(membershipNumber: string) {
  return fetchJson<{ positions: VmsPosition[] }>(`/positions`)
}

export function fetchPositionById(positionId: string, membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  return fetchJson<{ position: VmsPosition }>(`/positions/${encodeURIComponent(positionId)}${query}`)
}

export function createProjectPosition(
  payload: {
    projectId: string
    name: string
    description?: string
    createdBy: string
    seats?: number
    status?: 'open' | 'filled' | 'closed'
  },
  membershipNumber: string,
) {
  return postJson<{ position: VmsPosition }, typeof payload>(
    `/positions`,
    payload,
  )
}

export function updateProjectPosition(
  positionId: string,
  payload: Partial<{
    projectId: string
    name: string
    description: string
    createdBy: string
    seats: number
    status: 'open' | 'filled' | 'closed'
  }>,
  membershipNumber: string,
) {
  return putJson<{ position: VmsPosition }, typeof payload>(
    `/positions/${encodeURIComponent(positionId)}`,
    payload,
  )
}

export function deleteProjectPosition(positionId: string, membershipNumber: string) {
  return deleteJson(`/positions/${encodeURIComponent(positionId)}`)
}

export function createPositionApplication(
  positionId: string,
  payload: {
    motivationLetter?: string
  },
  membershipNumber: string,
) {
  return postJson<{ positionApplication: VmsPositionApplication }, typeof payload>(
    `/positions/${encodeURIComponent(positionId)}/applications`,
    payload,
  )
}

export function reviewPositionApplication(
  applicationId: string,
  payload: {
    status: 'accepted' | 'rejected'
  },
  membershipNumber: string,
) {
  return putJson<{ position: VmsPosition; positionApplication: VmsPositionApplication }, typeof payload>(
    `/position-applications/${encodeURIComponent(applicationId)}`,
    payload,
  )
}

export function createProjectMember(payload: {
  projectId: string
  membershipNumber: string
  role: 'member' | 'manager' | 'observer'
}, actorMembershipNumber: string) {
  return postJson<{ projectMember: VmsProjectMember }, typeof payload>(
    `/project-members`,
    payload,
  )
}

export function leaveProject(projectId: string, membershipNumber: string) {
  return removeProjectMember(projectId, membershipNumber, membershipNumber)
}

export function removeProjectMember(
  projectId: string,
  targetMembershipNumber: string,
  _actorMembershipNumber: string,
) {
  return deleteJson(
    `/project-members/${encodeURIComponent(projectId)}/${encodeURIComponent(targetMembershipNumber)}`,
  )
}

export function updateProjectMemberRole(
  projectId: string,
  targetMembershipNumber: string,
  role: 'member' | 'manager',
) {
  return putJson<{ projectMember: VmsProjectMember }, { role: typeof role }>(
    `/project-members/${encodeURIComponent(projectId)}/${encodeURIComponent(targetMembershipNumber)}`,
    { role },
  )
}

export function fetchClubs(projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
  return fetchJson<{ clubs: VmsClub[] }>(`/clubs${query}`)
}

export function fetchClubsDashboard(membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  return fetchJson<{ clubs: VmsClubDashboard[] }>(`/clubs-dashboard${query}`)
}

export function fetchClubById(clubId: string) {
  return fetchJson<{ club: VmsClub }>(`/clubs/${encodeURIComponent(clubId)}`)
}

export function createClub(payload: {
  projectId: string
  name: string
  description?: string
  imageUrl?: string
  telegramGroupId?: string
  country?: string
  region?: string
  city?: string
  address?: string
  visibility: 'public' | 'private' | 'draft'
  joinPolicy: 'auto_approve' | 'request_to_join' | 'invite_only'
  skills?: Record<string, string>
}, actorMembershipNumber: string) {
  return postJson<{ club: VmsClub }, typeof payload>(
    `/clubs`,
    payload,
  )
}

export function updateClub(
  clubId: string,
  payload: Partial<{
    name: string
    description: string
    imageUrl: string
    telegramGroupId: string
    country: string
    region: string
    city: string
    address: string
    visibility: 'public' | 'private' | 'draft'
    joinPolicy: 'auto_approve' | 'request_to_join' | 'invite_only'
    skills: Record<string, string>
  }>,
  actorMembershipNumber: string,
) {
  return putJson<{ club: VmsClub }, typeof payload>(
    `/clubs/${encodeURIComponent(clubId)}`,
    payload,
  )
}

export function deleteClub(clubId: string, actorMembershipNumber: string) {
  return deleteJson(`/clubs/${encodeURIComponent(clubId)}`)
}

export function fetchClubMembers(clubId?: string, status?: 'active' | 'pending' | 'rejected' | string) {
  const params = new URLSearchParams()

  if (clubId) {
    params.set('clubId', clubId)
  }

  if (status) {
    params.set('status', status)
  }

  const query = params.toString()
  return fetchJson<{ clubMembers: VmsClubMember[] }>(`/club-members${query ? `?${query}` : ''}`)
}

export function createClubMember(payload: {
  clubId: string
  membershipNumber: string
}, actorMembershipNumber: string) {
  return postJson<{ clubMember: VmsClubMember }, typeof payload>(
    `/club-members`,
    payload,
  )
}

export function requestTelegramGroupInvite(
  membershipNumber: string,
  payload: {
    resourceType: 'project' | 'club' | 'event'
    resourceId: string
  },
) {
  return postJson<{ success: boolean; detail?: string; data?: unknown }, typeof payload>(
    `/telegram/group-invite`,
    payload,
  )
}

export function updateClubMember(
  clubId: string,
  membershipNumber: string,
  payload: { status: 'active' | 'pending' | 'rejected' },
  actorMembershipNumber: string,
) {
  return putJson<{ clubMember: VmsClubMember }, typeof payload>(
    `/club-members/${encodeURIComponent(clubId)}/${encodeURIComponent(membershipNumber)}`,
    payload,
  )
}

export function deleteClubMember(clubId: string, membershipNumber: string, actorMembershipNumber: string) {
  return deleteJson(
    `/club-members/${encodeURIComponent(clubId)}/${encodeURIComponent(membershipNumber)}`,
  )
}

export function fetchPointTransactions(membershipNumber?: string) {
  const query = membershipNumber ? `` : ''
  return fetchJson<{ pointTransactions: VmsPointTransaction[] }>(`/point-transactions${query}`)
}

export function fetchLeaderboard() {
  return fetchJson<{ entries: VmsLeaderboardEntry[]; viewer: VmsLeaderboardViewer | null }>('/leaderboard')
}

export function fetchProjectNotes(projectId: string) {
  return fetchJson<{ notes: VmsProjectNote[] }>(`/project-notes?projectId=${encodeURIComponent(projectId)}`)
}

export function fetchProjectNoteById(noteId: string) {
  return fetchJson<{ note: VmsProjectNote }>(`/project-notes/${encodeURIComponent(noteId)}`)
}

export function createProjectNote(payload: {
  projectId: string
  title: string
  contentType?: 'html' | 'markdown'
}) {
  return postJson<{ note: VmsProjectNote }, typeof payload>(`/project-notes`, payload)
}

export function updateProjectNote(noteId: string, payload: { title?: string }) {
  return putJson<{ note: VmsProjectNote }, typeof payload>(`/project-notes/${encodeURIComponent(noteId)}`, payload)
}

export function deleteProjectNote(noteId: string) {
  return deleteJson(`/project-notes/${encodeURIComponent(noteId)}`)
}

export function editProjectNoteWithAi(
  noteId: string,
  payload: {
    command: string
    content: string
    contentType: 'html' | 'markdown'
    model: string
  },
) {
  return postJson<
    {
      edited: {
        content: string
        summary?: string
        model?: string
      }
    },
    typeof payload
  >(`/project-notes/${encodeURIComponent(noteId)}/ai-edit`, payload)
}

export function getProjectNotesRoomWebSocketUrl(projectId: string, token: string) {
  const memberMsBaseUrl = (import.meta.env.VITE_MEMBER_MS as string | undefined)?.trim()

  if (memberMsBaseUrl) {
    const wsBase = memberMsBaseUrl.replace(/^http/i, 'ws').replace(/\/+$/, '')
    return `${wsBase}/api/projects/${encodeURIComponent(projectId)}/notes/ws?token=${encodeURIComponent(token)}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.DEV ? `${window.location.hostname}:5931` : window.location.host
  return `${protocol}//${host}/ms/membership-app/api/projects/${encodeURIComponent(projectId)}/notes/ws?token=${encodeURIComponent(token)}`
}

export async function uploadImages(files: File[]): Promise<{ images: string[] }> {
  const formData = new FormData()

  for (const file of files) {
    formData.append('images', file)
  }

  const response = await apiFetch('/images/upload', { method: 'POST', body: formData })

  if (!response.ok) {
    const fallbackMessage = `Upload failed (${response.status})`
    let message = fallbackMessage

    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) {
        message = body.error
      }
    } catch {
      // Ignore JSON parsing errors and keep fallback message.
    }

    throw new Error(message)
  }

  const data = (await response.json()) as { success: boolean; imageUrls: Record<string, string> }
  return { images: Object.values(data.imageUrls) }
}

export async function uploadEventBanner(eventId: string, file: File) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await apiFetch(`/events/${encodeURIComponent(eventId)}/banner`, {
    method: 'PUT',
    body: formData,
  })

  if (!response.ok) {
    const fallbackMessage = `Upload failed (${response.status})`
    let message = fallbackMessage

    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) {
        message = body.error
      }
    } catch {
      // Ignore JSON parsing errors and keep fallback message.
    }

    throw new Error(message)
  }

  return (await response.json()) as { event: VmsEvent }
}

export async function uploadClubBanner(clubId: string, file: File) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await apiFetch(`/clubs/${encodeURIComponent(clubId)}/banner`, {
    method: 'PUT',
    body: formData,
  })

  if (!response.ok) {
    const fallbackMessage = `Upload failed (${response.status})`
    let message = fallbackMessage

    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) {
        message = body.error
      }
    } catch {
      // Ignore JSON parsing errors and keep fallback message.
    }

    throw new Error(message)
  }

  return (await response.json()) as { club: VmsClub }
}
