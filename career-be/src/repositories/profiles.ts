import type { Environment } from '../types/env'
import { createId, nowIso } from '../utils/id'

export type CareerProfileRow = {
  membership_number: string
  headline: string | null
  summary: string | null
  is_published: number
  created_at: string
  updated_at: string
}

export type WorkExperienceRow = {
  id: string
  membership_number: string
  company_name: string
  title: string
  location: string | null
  start_date: string | null
  end_date: string | null
  is_current: number
  description: string | null
  responsibilities: string | null
  achievements: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ProjectRow = {
  id: string
  membership_number: string
  name: string
  role: string | null
  project_type: string | null
  company: string | null
  start_date: string | null
  end_date: string | null
  is_ongoing: number
  tools: string | null
  responsibilities: string | null
  outcomes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  membership_number: string
  kind: string
  file_name: string
  content_type: string
  r2_key: string
  size_bytes: number
  created_at: string
}

export async function ensureCareerProfile(
  env: Environment,
  membershipNumber: string,
): Promise<CareerProfileRow> {
  const existing = await env.D1_DB.prepare(
    `SELECT membership_number, headline, summary, is_published, created_at, updated_at
     FROM career_profiles WHERE membership_number = ? LIMIT 1`,
  )
    .bind(membershipNumber)
    .first<CareerProfileRow>()

  if (existing) return existing

  const stamp = nowIso()
  await env.D1_DB.prepare(
    `INSERT INTO career_profiles (membership_number, headline, summary, is_published, created_at, updated_at)
     VALUES (?, NULL, NULL, 0, ?, ?)`,
  )
    .bind(membershipNumber, stamp, stamp)
    .run()

  return {
    membership_number: membershipNumber,
    headline: null,
    summary: null,
    is_published: 0,
    created_at: stamp,
    updated_at: stamp,
  }
}

export async function updateCareerProfile(
  env: Environment,
  membershipNumber: string,
  patch: { headline?: string | null; summary?: string | null; is_published?: boolean },
): Promise<CareerProfileRow> {
  await ensureCareerProfile(env, membershipNumber)
  const stamp = nowIso()

  const current = await env.D1_DB.prepare(
    `SELECT membership_number, headline, summary, is_published, created_at, updated_at
     FROM career_profiles WHERE membership_number = ?`,
  )
    .bind(membershipNumber)
    .first<CareerProfileRow>()

  if (!current) {
    throw new Error('profile missing after ensure')
  }

  const headline = patch.headline !== undefined ? patch.headline : current.headline
  const summary = patch.summary !== undefined ? patch.summary : current.summary
  const isPublished =
    patch.is_published !== undefined ? (patch.is_published ? 1 : 0) : current.is_published

  await env.D1_DB.prepare(
    `UPDATE career_profiles
     SET headline = ?, summary = ?, is_published = ?, updated_at = ?
     WHERE membership_number = ?`,
  )
    .bind(headline, summary, isPublished, stamp, membershipNumber)
    .run()

  return {
    ...current,
    headline,
    summary,
    is_published: isPublished,
    updated_at: stamp,
  }
}

export async function listWorkExperiences(
  env: Environment,
  membershipNumber: string,
): Promise<WorkExperienceRow[]> {
  const result = await env.D1_DB.prepare(
    `SELECT * FROM work_experiences
     WHERE membership_number = ?
     ORDER BY sort_order ASC, start_date DESC, created_at DESC`,
  )
    .bind(membershipNumber)
    .all<WorkExperienceRow>()
  return result.results ?? []
}

export async function createWorkExperience(
  env: Environment,
  membershipNumber: string,
  input: {
    company_name: string
    title: string
    location?: string | null
    start_date?: string | null
    end_date?: string | null
    is_current?: boolean
    description?: string | null
    responsibilities?: string | null
    achievements?: string | null
    sort_order?: number
  },
): Promise<WorkExperienceRow> {
  await ensureCareerProfile(env, membershipNumber)
  const stamp = nowIso()
  const id = createId('wx')
  const responsibilities = input.responsibilities?.trim() || null
  const description = input.description?.trim() || responsibilities
  const row: WorkExperienceRow = {
    id,
    membership_number: membershipNumber,
    company_name: input.company_name.trim(),
    title: input.title.trim(),
    location: input.location?.trim() || null,
    start_date: input.start_date?.trim() || null,
    end_date: input.end_date?.trim() || null,
    is_current: input.is_current ? 1 : 0,
    description,
    responsibilities,
    achievements: input.achievements?.trim() || null,
    sort_order: input.sort_order ?? 0,
    created_at: stamp,
    updated_at: stamp,
  }

  await env.D1_DB.prepare(
    `INSERT INTO work_experiences
     (id, membership_number, company_name, title, location, start_date, end_date, is_current, description, responsibilities, achievements, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.membership_number,
      row.company_name,
      row.title,
      row.location,
      row.start_date,
      row.end_date,
      row.is_current,
      row.description,
      row.responsibilities,
      row.achievements,
      row.sort_order,
      row.created_at,
      row.updated_at,
    )
    .run()

  return row
}

export async function updateWorkExperience(
  env: Environment,
  membershipNumber: string,
  id: string,
  input: Partial<{
    company_name: string
    title: string
    location: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
    description: string | null
    responsibilities: string | null
    achievements: string | null
    sort_order: number
  }>,
): Promise<WorkExperienceRow | null> {
  const existing = await env.D1_DB.prepare(
    `SELECT * FROM work_experiences WHERE id = ? AND membership_number = ? LIMIT 1`,
  )
    .bind(id, membershipNumber)
    .first<WorkExperienceRow>()
  if (!existing) return null

  const stamp = nowIso()
  const responsibilities =
    input.responsibilities !== undefined
      ? input.responsibilities?.trim() || null
      : existing.responsibilities ?? null
  const description =
    input.description !== undefined
      ? input.description?.trim() || null
      : responsibilities || existing.description
  const row: WorkExperienceRow = {
    ...existing,
    company_name: input.company_name?.trim() ?? existing.company_name,
    title: input.title?.trim() ?? existing.title,
    location: input.location !== undefined ? input.location?.trim() || null : existing.location,
    start_date: input.start_date !== undefined ? input.start_date?.trim() || null : existing.start_date,
    end_date: input.end_date !== undefined ? input.end_date?.trim() || null : existing.end_date,
    is_current: input.is_current !== undefined ? (input.is_current ? 1 : 0) : existing.is_current,
    description,
    responsibilities,
    achievements:
      input.achievements !== undefined
        ? input.achievements?.trim() || null
        : existing.achievements ?? null,
    sort_order: input.sort_order ?? existing.sort_order,
    updated_at: stamp,
  }

  await env.D1_DB.prepare(
    `UPDATE work_experiences
     SET company_name = ?, title = ?, location = ?, start_date = ?, end_date = ?,
         is_current = ?, description = ?, responsibilities = ?, achievements = ?, sort_order = ?, updated_at = ?
     WHERE id = ? AND membership_number = ?`,
  )
    .bind(
      row.company_name,
      row.title,
      row.location,
      row.start_date,
      row.end_date,
      row.is_current,
      row.description,
      row.responsibilities,
      row.achievements,
      row.sort_order,
      row.updated_at,
      id,
      membershipNumber,
    )
    .run()

  return row
}

export async function deleteWorkExperience(
  env: Environment,
  membershipNumber: string,
  id: string,
): Promise<boolean> {
  const result = await env.D1_DB.prepare(
    `DELETE FROM work_experiences WHERE id = ? AND membership_number = ?`,
  )
    .bind(id, membershipNumber)
    .run()
  return (result.meta?.changes ?? 0) > 0
}

export async function listDocuments(
  env: Environment,
  membershipNumber: string,
): Promise<DocumentRow[]> {
  const result = await env.D1_DB.prepare(
    `SELECT * FROM documents WHERE membership_number = ? ORDER BY created_at DESC`,
  )
    .bind(membershipNumber)
    .all<DocumentRow>()
  return result.results ?? []
}

export async function createDocument(
  env: Environment,
  membershipNumber: string,
  input: {
    kind: string
    file_name: string
    content_type: string
    r2_key: string
    size_bytes: number
  },
): Promise<DocumentRow> {
  await ensureCareerProfile(env, membershipNumber)
  const stamp = nowIso()
  const row: DocumentRow = {
    id: createId('doc'),
    membership_number: membershipNumber,
    kind: input.kind,
    file_name: input.file_name,
    content_type: input.content_type,
    r2_key: input.r2_key,
    size_bytes: input.size_bytes,
    created_at: stamp,
  }

  await env.D1_DB.prepare(
    `INSERT INTO documents (id, membership_number, kind, file_name, content_type, r2_key, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.membership_number,
      row.kind,
      row.file_name,
      row.content_type,
      row.r2_key,
      row.size_bytes,
      row.created_at,
    )
    .run()

  return row
}

export async function getDocument(
  env: Environment,
  membershipNumber: string,
  id: string,
): Promise<DocumentRow | null> {
  return env.D1_DB.prepare(
    `SELECT * FROM documents WHERE id = ? AND membership_number = ? LIMIT 1`,
  )
    .bind(id, membershipNumber)
    .first<DocumentRow>()
}

export async function deleteDocument(
  env: Environment,
  membershipNumber: string,
  id: string,
): Promise<DocumentRow | null> {
  const existing = await getDocument(env, membershipNumber, id)
  if (!existing) return null
  await env.D1_DB.prepare(`DELETE FROM documents WHERE id = ? AND membership_number = ?`)
    .bind(id, membershipNumber)
    .run()
  return existing
}

export async function searchPublishedProfiles(
  env: Environment,
  query: string | undefined,
  limit = 50,
): Promise<CareerProfileRow[]> {
  const needle = query?.trim()
  if (!needle) {
    const result = await env.D1_DB.prepare(
      `SELECT * FROM career_profiles WHERE is_published = 1 ORDER BY updated_at DESC LIMIT ?`,
    )
      .bind(limit)
      .all<CareerProfileRow>()
    return result.results ?? []
  }

  const like = `%${needle.replace(/[%_]/g, '')}%`
  const result = await env.D1_DB.prepare(
    `SELECT * FROM career_profiles
     WHERE is_published = 1
       AND (COALESCE(headline, '') LIKE ? OR COALESCE(summary, '') LIKE ? OR membership_number LIKE ?)
     ORDER BY updated_at DESC
     LIMIT ?`,
  )
    .bind(like, like, like, limit)
    .all<CareerProfileRow>()
  return result.results ?? []
}

export async function getPublishedProfile(
  env: Environment,
  membershipNumber: string,
): Promise<CareerProfileRow | null> {
  return env.D1_DB.prepare(
    `SELECT * FROM career_profiles WHERE membership_number = ? AND is_published = 1 LIMIT 1`,
  )
    .bind(membershipNumber)
    .first<CareerProfileRow>()
}

export async function listProjects(
  env: Environment,
  membershipNumber: string,
): Promise<ProjectRow[]> {
  const result = await env.D1_DB.prepare(
    `SELECT * FROM projects
     WHERE membership_number = ?
     ORDER BY sort_order ASC, start_date DESC, created_at DESC`,
  )
    .bind(membershipNumber)
    .all<ProjectRow>()
  return result.results ?? []
}

export async function createProject(
  env: Environment,
  membershipNumber: string,
  input: {
    name: string
    role?: string | null
    project_type?: string | null
    company?: string | null
    start_date?: string | null
    end_date?: string | null
    is_ongoing?: boolean
    tools?: string | null
    responsibilities?: string | null
    outcomes?: string | null
    sort_order?: number
  },
): Promise<ProjectRow> {
  await ensureCareerProfile(env, membershipNumber)
  const stamp = nowIso()
  const row: ProjectRow = {
    id: createId('prj'),
    membership_number: membershipNumber,
    name: input.name.trim(),
    role: input.role?.trim() || null,
    project_type: input.project_type?.trim() || null,
    company: input.company?.trim() || null,
    start_date: input.start_date?.trim() || null,
    end_date: input.end_date?.trim() || null,
    is_ongoing: input.is_ongoing ? 1 : 0,
    tools: input.tools?.trim() || null,
    responsibilities: input.responsibilities?.trim() || null,
    outcomes: input.outcomes?.trim() || null,
    sort_order: input.sort_order ?? 0,
    created_at: stamp,
    updated_at: stamp,
  }

  await env.D1_DB.prepare(
    `INSERT INTO projects
     (id, membership_number, name, role, project_type, company, start_date, end_date, is_ongoing, tools, responsibilities, outcomes, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.membership_number,
      row.name,
      row.role,
      row.project_type,
      row.company,
      row.start_date,
      row.end_date,
      row.is_ongoing,
      row.tools,
      row.responsibilities,
      row.outcomes,
      row.sort_order,
      row.created_at,
      row.updated_at,
    )
    .run()

  return row
}

export async function deleteProject(
  env: Environment,
  membershipNumber: string,
  id: string,
): Promise<boolean> {
  const result = await env.D1_DB.prepare(
    `DELETE FROM projects WHERE id = ? AND membership_number = ?`,
  )
    .bind(id, membershipNumber)
    .run()
  return (result.meta?.changes ?? 0) > 0
}

export async function hasAppliedToCompanyJob(
  env: Environment,
  membershipNumber: string,
  companyId: string,
): Promise<boolean> {
  const row = await env.D1_DB.prepare(
    `SELECT a.id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.membership_number = ? AND j.company_id = ?
     LIMIT 1`,
  )
    .bind(membershipNumber, companyId)
    .first<{ id: string }>()
  return Boolean(row)
}
