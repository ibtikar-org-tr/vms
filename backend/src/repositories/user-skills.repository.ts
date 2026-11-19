import type { D1DatabaseLike } from '../types/bindings'

export interface UserSkill {
  membershipNumber: string
  skillId: string
  proficiencyLevel: 'beginner' | 'intermediate' | 'expert'
  type: 'skill' | 'interest'
  createdAt: string
  updatedAt: string
}

interface UserSkillRow {
  membership_number: string
  skill_id: string
  proficiency_level: string
  type: string
  created_at: string
  updated_at: string
}

function mapUserSkillRow(row: UserSkillRow): UserSkill {
  return {
    membershipNumber: row.membership_number,
    skillId: row.skill_id,
    proficiencyLevel: row.proficiency_level as 'beginner' | 'intermediate' | 'expert',
    type: row.type as 'skill' | 'interest',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function addUserSkill(
  db: D1DatabaseLike,
  membershipNumber: string,
  skillId: string,
  type: 'skill' | 'interest',
  proficiencyLevel?: 'beginner' | 'intermediate' | 'expert'
): Promise<UserSkill> {
  await db
    .prepare(
      `INSERT INTO user_skills (membership_number, skill_id, type, proficiency_level)
       VALUES (?, ?, ?, ?)`
    )
    .bind(membershipNumber, skillId, type, proficiencyLevel ?? null)
    .run()

  return getUserSkill(db, membershipNumber, skillId)
}

export async function upsertUserSkill(
  db: D1DatabaseLike,
  membershipNumber: string,
  skillId: string,
  type: 'skill' | 'interest',
  proficiencyLevel?: 'beginner' | 'intermediate' | 'expert'
): Promise<UserSkill> {
  await db
    .prepare(
      `INSERT INTO user_skills (membership_number, skill_id, type, proficiency_level)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(membership_number, skill_id) DO UPDATE SET
         type = excluded.type,
         proficiency_level = COALESCE(excluded.proficiency_level, user_skills.proficiency_level),
         updated_at = datetime('now')`
    )
    .bind(membershipNumber, skillId, type, proficiencyLevel ?? null)
    .run()

  return getUserSkill(db, membershipNumber, skillId)
}

export async function getUserSkill(db: D1DatabaseLike, membershipNumber: string, skillId: string): Promise<UserSkill> {
  const row = await db
    .prepare(
      `SELECT membership_number, skill_id, proficiency_level, type, created_at, updated_at
       FROM user_skills
       WHERE membership_number = ? AND skill_id = ?`
    )
    .bind(membershipNumber, skillId)
    .first<UserSkillRow>()

  if (!row) {
    throw new Error(`User skill not found for membership ${membershipNumber} and skill ${skillId}`)
  }

  return mapUserSkillRow(row)
}

export async function getUserSkillsByMembershipNumber(
  db: D1DatabaseLike,
  membershipNumber: string,
  type?: 'skill' | 'interest'
): Promise<UserSkill[]> {
  let query = `SELECT membership_number, skill_id, proficiency_level, type, created_at, updated_at
               FROM user_skills
               WHERE membership_number = ?`
  const params: unknown[] = [membershipNumber]

  if (type) {
    query += ` AND type = ?`
    params.push(type)
  }

  query += ` ORDER BY created_at DESC`

  const result = await db.prepare(query).bind(...params).all<UserSkillRow>()

  return result.results.map(mapUserSkillRow)
}

export async function updateUserSkill(
  db: D1DatabaseLike,
  membershipNumber: string,
  skillId: string,
  proficiencyLevel?: 'beginner' | 'intermediate' | 'expert'
): Promise<UserSkill> {
  if (proficiencyLevel === undefined) {
    return getUserSkill(db, membershipNumber, skillId)
  }

  await db
    .prepare(`UPDATE user_skills SET proficiency_level = ? WHERE membership_number = ? AND skill_id = ?`)
    .bind(proficiencyLevel, membershipNumber, skillId)
    .run()

  return getUserSkill(db, membershipNumber, skillId)
}

export async function deleteUserSkill(db: D1DatabaseLike, membershipNumber: string, skillId: string): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM user_skills WHERE membership_number = ? AND skill_id = ?`)
    .bind(membershipNumber, skillId)
    .run()

  return (result.meta.changes ?? 0) > 0
}

export async function deleteAllUserSkillsByMembershipNumber(db: D1DatabaseLike, membershipNumber: string): Promise<void> {
  await db.prepare(`DELETE FROM user_skills WHERE membership_number = ?`).bind(membershipNumber).run()
}

export async function deleteUserSkillsByType(
  db: D1DatabaseLike,
  membershipNumber: string,
  type: 'skill' | 'interest',
): Promise<void> {
  await db
    .prepare(`DELETE FROM user_skills WHERE membership_number = ? AND type = ?`)
    .bind(membershipNumber, type)
    .run()
}
