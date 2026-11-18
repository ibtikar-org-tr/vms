import type { Environment } from '../types/env'
import { createId, nowIso } from '../utils/id'

export type MemberSkill = {
  skillId: string
  name: string
  proficiencyLevel: string | null
  type: 'skill' | 'interest'
}

export type EntitySkill = {
  id: string
  membership_number: string
  entity_type: string
  entity_id: string
  skill_id: string
  skill_name: string
  created_at: string
}

async function getSkillById(env: Environment, skillId: string) {
  return env.VMS_DB.prepare(
    `SELECT id, name FROM skills WHERE id = ? LIMIT 1`,
  )
    .bind(skillId)
    .first<{ id: string; name: string }>()
}

async function getSkillByName(env: Environment, name: string) {
  return env.VMS_DB.prepare(
    `SELECT id, name FROM skills WHERE lower(name) = lower(?) LIMIT 1`,
  )
    .bind(name.trim())
    .first<{ id: string; name: string }>()
}

async function createSkill(env: Environment, name: string) {
  const id = createId('sk')
  await env.VMS_DB.prepare(
    `INSERT INTO skills (id, name, description, members, events, tasks) VALUES (?, ?, NULL, 0, 0, 0)`,
  )
    .bind(id, name.trim())
    .run()
  return { id, name: name.trim() }
}

async function upsertMemberSkill(
  env: Environment,
  membershipNumber: string,
  skillId: string,
) {
  await env.MEMBERS_DB.prepare(
    `INSERT INTO user_skills (membership_number, skill_id, type, proficiency_level)
     VALUES (?, ?, 'skill', 'beginner')
     ON CONFLICT(membership_number, skill_id) DO UPDATE SET
       type = 'skill',
       updated_at = datetime('now')`,
  )
    .bind(membershipNumber, skillId)
    .run()
}

/** List the member's VMS skills (type=skill), with names from VMS skills table. */
export async function listMemberSkills(
  env: Environment,
  membershipNumber: string,
): Promise<MemberSkill[]> {
  const rows = await env.MEMBERS_DB.prepare(
    `SELECT skill_id, proficiency_level, type
     FROM user_skills
     WHERE membership_number = ? AND type = 'skill'
     ORDER BY created_at DESC`,
  )
    .bind(membershipNumber)
    .all<{ skill_id: string; proficiency_level: string | null; type: string }>()

  const result: MemberSkill[] = []
  for (const row of rows.results ?? []) {
    const skill = await getSkillById(env, row.skill_id)
    if (!skill?.name) continue
    result.push({
      skillId: row.skill_id,
      name: skill.name,
      proficiencyLevel: row.proficiency_level,
      type: 'skill',
    })
  }
  return result
}

/**
 * Resolve skill names/ids: reuse existing VMS skills, create missing ones,
 * ensure they are on the member's user_skills, return canonical {skillId, name}[].
 */
export async function ensureMemberSkills(
  env: Environment,
  membershipNumber: string,
  skills: Array<{ skillId?: string; name?: string }>,
): Promise<Array<{ skillId: string; name: string }>> {
  const resolved: Array<{ skillId: string; name: string }> = []
  const seen = new Set<string>()

  for (const item of skills) {
    let skillId = item.skillId?.trim() || ''
    let name = item.name?.trim() || ''

    if (skillId) {
      const existing = await getSkillById(env, skillId)
      if (!existing) continue
      skillId = existing.id
      name = existing.name
    } else if (name) {
      const byName = await getSkillByName(env, name)
      if (byName) {
        skillId = byName.id
        name = byName.name
      } else {
        const created = await createSkill(env, name)
        skillId = created.id
        name = created.name
      }
    } else {
      continue
    }

    if (seen.has(skillId)) continue
    seen.add(skillId)
    await upsertMemberSkill(env, membershipNumber, skillId)
    resolved.push({ skillId, name })
  }

  return resolved
}

export async function replaceEntitySkills(
  env: Environment,
  membershipNumber: string,
  entityType: 'project' | 'work_experience',
  entityId: string,
  skills: Array<{ skillId: string; name: string }>,
): Promise<EntitySkill[]> {
  await env.D1_DB.prepare(
    `DELETE FROM entity_skills WHERE entity_type = ? AND entity_id = ?`,
  )
    .bind(entityType, entityId)
    .run()

  const stamp = nowIso()
  const rows: EntitySkill[] = []
  for (const skill of skills) {
    const row: EntitySkill = {
      id: createId('esk'),
      membership_number: membershipNumber,
      entity_type: entityType,
      entity_id: entityId,
      skill_id: skill.skillId,
      skill_name: skill.name,
      created_at: stamp,
    }
    await env.D1_DB.prepare(
      `INSERT INTO entity_skills
       (id, membership_number, entity_type, entity_id, skill_id, skill_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        row.id,
        row.membership_number,
        row.entity_type,
        row.entity_id,
        row.skill_id,
        row.skill_name,
        row.created_at,
      )
      .run()
    rows.push(row)
  }
  return rows
}

export async function deleteEntitySkills(
  env: Environment,
  entityType: 'project' | 'work_experience',
  entityId: string,
): Promise<void> {
  await env.D1_DB.prepare(
    `DELETE FROM entity_skills WHERE entity_type = ? AND entity_id = ?`,
  )
    .bind(entityType, entityId)
    .run()
}

export async function listEntitySkills(
  env: Environment,
  entityType: 'project' | 'work_experience',
  entityId: string,
): Promise<EntitySkill[]> {
  const result = await env.D1_DB.prepare(
    `SELECT * FROM entity_skills WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC`,
  )
    .bind(entityType, entityId)
    .all<EntitySkill>()
  return result.results ?? []
}

export async function listEntitySkillsForMany(
  env: Environment,
  entityType: 'project' | 'work_experience',
  entityIds: string[],
): Promise<Record<string, EntitySkill[]>> {
  const map: Record<string, EntitySkill[]> = {}
  for (const id of entityIds) map[id] = []
  if (!entityIds.length) return map

  // D1 has bind limits; chunk if needed
  for (let i = 0; i < entityIds.length; i += 40) {
    const chunk = entityIds.slice(i, i + 40)
    const placeholders = chunk.map(() => '?').join(',')
    const result = await env.D1_DB.prepare(
      `SELECT * FROM entity_skills
       WHERE entity_type = ? AND entity_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
      .bind(entityType, ...chunk)
      .all<EntitySkill>()
    for (const row of result.results ?? []) {
      map[row.entity_id] = map[row.entity_id] || []
      map[row.entity_id].push(row)
    }
  }
  return map
}
