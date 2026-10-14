import type { D1DatabaseLike } from '../types/bindings'
import { isEventAdmin } from '../repositories/vms-event-admins.repository'
import { canManageProject } from './project-access'

const MAX_PROJECT_ANCESTOR_DEPTH = 20

export type EventManagementContext = {
  id: string
  createdBy: string
  projectId: string | null
  projectOwner?: string | null
}

export async function canManageEvent(
  db: D1DatabaseLike,
  event: EventManagementContext,
  membershipNumber: string | null | undefined,
): Promise<boolean> {
  if (!membershipNumber) {
    return false
  }

  if (event.createdBy === membershipNumber) {
    return true
  }

  if (await isEventAdmin(db, event.id, membershipNumber)) {
    return true
  }

  let projectId = event.projectId
  const seen = new Set<string>()

  for (let depth = 0; projectId && depth < MAX_PROJECT_ANCESTOR_DEPTH; depth += 1) {
    if (seen.has(projectId)) {
      break
    }
    seen.add(projectId)

    const access = await canManageProject(db, projectId, membershipNumber)
    if (access.isAuthorized) {
      return true
    }

    projectId = access.project?.parentProjectId ?? null
  }

  return false
}
