import { createSkill, getSkillById, getSkillByName } from '../repositories/vms-skills.repository'
import {
  deleteUserSkillsByType,
  getUserSkillsByMembershipNumber,
  upsertUserSkill,
} from '../repositories/user-skills.repository'
import type { AppBindings } from '../types/bindings'
import { generateId } from '../utils/id'

function uniqueTrimmedValues(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function splitCsv(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return uniqueTrimmedValues(value.split(/[,،\n]/).map((part) => part.trim()))
}

async function getOrCreateSkillId(vmsDb: AppBindings['VMS_DB'], skillName: string): Promise<string> {
  const existing = await getSkillByName(vmsDb, skillName)
  if (existing) return existing.id

  const skillId = generateId()
  await createSkill(vmsDb, { id: skillId, name: skillName })
  return skillId
}

export async function hydrateProfileSkills(
  membersDb: AppBindings['MEMBERS_DB'],
  vmsDb: AppBindings['VMS_DB'],
  membershipNumber: string,
): Promise<{ skills: string | null; interests: string | null }> {
  const rows = await getUserSkillsByMembershipNumber(membersDb, membershipNumber)
  const skillNames: string[] = []
  const interestNames: string[] = []

  for (const row of rows) {
    const skill = await getSkillById(vmsDb, row.skillId)
    const name = skill?.name?.trim()
    if (!name) continue
    if (row.type === 'interest') interestNames.push(name)
    else skillNames.push(name)
  }

  return {
    skills: skillNames.length ? skillNames.join(', ') : null,
    interests: interestNames.length ? interestNames.join(', ') : null,
  }
}

export async function replaceProfileSkillsFromText(
  membersDb: AppBindings['MEMBERS_DB'],
  vmsDb: AppBindings['VMS_DB'],
  membershipNumber: string,
  skillsText: string | null | undefined,
  interestsText: string | null | undefined,
): Promise<void> {
  if (skillsText !== undefined) {
    await deleteUserSkillsByType(membersDb, membershipNumber, 'skill')
    for (const name of splitCsv(skillsText)) {
      const skillId = await getOrCreateSkillId(vmsDb, name)
      await upsertUserSkill(membersDb, membershipNumber, skillId, 'skill', 'beginner')
    }
  }

  if (interestsText !== undefined) {
    await deleteUserSkillsByType(membersDb, membershipNumber, 'interest')
    for (const name of splitCsv(interestsText)) {
      const skillId = await getOrCreateSkillId(vmsDb, name)
      await upsertUserSkill(membersDb, membershipNumber, skillId, 'interest')
    }
  }
}
