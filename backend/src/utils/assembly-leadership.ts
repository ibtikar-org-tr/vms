import { listMemberProjectAffiliations } from '../repositories/vms-member-title.repository'
import type { D1DatabaseLike } from '../types/bindings'
import { isBoardProject } from './member-display-title'

export function isPlatformAdminRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() === 'admin'
}

export async function isAssemblyLeadership(
  db: D1DatabaseLike,
  actor: { membershipNumber: string; role: string },
) {
  if (isPlatformAdminRole(actor.role)) {
    return true
  }

  const affiliations = await listMemberProjectAffiliations(db, actor.membershipNumber)
  return affiliations.some(
    (affiliation) =>
      isBoardProject(affiliation.projectName) && (affiliation.role === 'owner' || affiliation.role === 'manager'),
  )
}
