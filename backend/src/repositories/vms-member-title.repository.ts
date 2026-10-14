import type { D1DatabaseLike } from '../types/bindings'
import type { MemberPositionAffiliation, MemberProjectAffiliation } from '../utils/member-display-title'

interface MemberProjectRow {
  project_name: string
  parent_project_id: string | null
  role: string
}

interface MemberPositionRow {
  position_name: string
  project_name: string
  parent_project_id: string | null
}

export async function listMemberProjectAffiliations(
  db: D1DatabaseLike,
  membershipNumber: string,
): Promise<MemberProjectAffiliation[]> {
  const result = await db
    .prepare(
      `SELECT
         p.name AS project_name,
         p.parent_project_id AS parent_project_id,
         CASE WHEN p.owner = ? THEN 'owner' ELSE COALESCE(pm.role, 'member') END AS role
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.membership_number = ?
       WHERE p.owner = ? OR pm.membership_number = ?`,
    )
    .bind(membershipNumber, membershipNumber, membershipNumber, membershipNumber)
    .all<MemberProjectRow>()

  return (result.results ?? []).map((row) => ({
    projectName: row.project_name,
    parentProjectId: row.parent_project_id,
    role: row.role,
  }))
}

export async function listMemberAcceptedPositions(
  db: D1DatabaseLike,
  membershipNumber: string,
): Promise<MemberPositionAffiliation[]> {
  const result = await db
    .prepare(
      `SELECT
         pos.name AS position_name,
         p.name AS project_name,
         p.parent_project_id AS parent_project_id
       FROM position_applications pa
       INNER JOIN positions pos ON pos.id = pa.position_id
       INNER JOIN projects p ON p.id = pos.project_id
       WHERE pa.membership_number = ? AND pa.status = ?`,
    )
    .bind(membershipNumber, 'accepted')
    .all<MemberPositionRow>()

  return (result.results ?? []).map((row) => ({
    positionName: row.position_name,
    projectName: row.project_name,
    parentProjectId: row.parent_project_id,
  }))
}
