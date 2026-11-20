import { Hono } from 'hono'
import { memberAuthMiddleware } from '../middleware/auth'
import {
  decideCvAccessRequest,
  getCvAccessBetween,
  hasAcceptedCvAccess,
  listOwnerAccessRequests,
  requestCvAccess,
} from '../repositories/cv-access'
import {
  createDocument,
  createProject,
  createWorkExperience,
  deleteDocument,
  deleteProject,
  deleteWorkExperience,
  ensureCareerProfile,
  getDocument,
  getPublishedProfile,
  getWorkPreferences,
  listDocuments,
  listProfileLanguages,
  listProjects,
  listWorkExperiences,
  mergeLanguagePreferences,
  replaceProfileLanguages,
  replaceWorkPreferences,
  searchPublishedProfiles,
  updateCareerProfile,
  updateWorkExperience,
} from '../repositories/profiles'
import { fetchVmsPartnerProfile, fetchVmsSelfProfile } from '../repositories/vms-profile'
import {
  deleteEntitySkills,
  ensureMemberSkills,
  listEntitySkillsForMany,
  listMemberSkills,
  replaceEntitySkills,
} from '../repositories/vms-skills'
import type { AppBindings } from '../types/env'
import {
  redactDocuments,
  redactProjects,
  redactVmsProfile,
  redactWorkExperiences,
  type CvAccessStatus,
} from '../utils/cv-privacy'
import { createId } from '../utils/id'

const profilesRouter = new Hono<AppBindings>()

type SkillInput = { skillId?: string; name?: string }

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_DOC_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

async function attachSkills<T extends { id: string }>(
  env: AppBindings['Bindings'],
  entityType: 'project' | 'work_experience',
  rows: T[],
) {
  const map = await listEntitySkillsForMany(
    env,
    entityType,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({
    ...row,
    skills: (map[row.id] || []).map((s) => ({
      skillId: s.skill_id,
      name: s.skill_name,
    })),
  }))
}

profilesRouter.use('*', memberAuthMiddleware)

profilesRouter.get('/me/skills', async (c) => {
  const member = c.get('member')
  try {
    const skills = await listMemberSkills(c.env, member.membership_number)
    return c.json({ skills })
  } catch (error) {
    console.error('listMemberSkills failed', error)
    return c.json({ message: 'تعذّر قراءة مهارات منصة الأعضاء', skills: [] }, 500)
  }
})

profilesRouter.get('/me', async (c) => {
  const member = c.get('member')
  const profile = await ensureCareerProfile(c.env, member.membership_number)
  const workExperiences = await attachSkills(
    c.env,
    'work_experience',
    await listWorkExperiences(c.env, member.membership_number),
  )
  const projects = await attachSkills(
    c.env,
    'project',
    await listProjects(c.env, member.membership_number),
  )
  const documents = await listDocuments(c.env, member.membership_number)
  const memberSkills = await listMemberSkills(c.env, member.membership_number).catch(() => [])
  const languageRows = await listProfileLanguages(c.env, member.membership_number)
  const vmsProfile = await fetchVmsSelfProfile(
    c.env,
    member.membership_number,
    c.req.header('Authorization'),
  )
  const languages = mergeLanguagePreferences(vmsProfile?.languages, languageRows)
  const workPreferences = await getWorkPreferences(c.env, member.membership_number)

  return c.json({
    profile,
    workExperiences,
    projects,
    documents: documents.map(({ r2_key: _r2, ...rest }) => rest),
    memberSkills,
    languages,
    workPreferences,
    vmsProfile,
  })
})

profilesRouter.patch('/me', async (c) => {
  const member = c.get('member')
  const body = await c.req
    .json<{
      headline?: string | null
      summary?: string | null
      is_published?: boolean
      can_relocate?: boolean
      relocate_notes?: string | null
    }>()
    .catch(() => ({}))

  const profile = await updateCareerProfile(c.env, member.membership_number, body)
  return c.json({ profile })
})

profilesRouter.put('/me/languages', async (c) => {
  const member = c.get('member')
  const body = await c.req
    .json<{
      languages?: Array<{ language: string; proficiency?: number | null; openToTranslate?: boolean }>
    }>()
    .catch(() => ({}))

  const languages = await replaceProfileLanguages(
    c.env,
    member.membership_number,
    Array.isArray(body.languages) ? body.languages : [],
  )
  return c.json({ languages })
})

profilesRouter.put('/me/work-preferences', async (c) => {
  const member = c.get('member')
  const body = await c.req
    .json<{
      canRelocate?: boolean
      relocateNotes?: string | null
      jobTypes?: Array<'full_time' | 'part_time' | 'temp_full_time' | string>
      locations?: Array<{
        kind?: string
        countryName?: string | null
        salaryMin?: number | null
        salaryMax?: number | null
        currency?: string | null
      }>
    }>()
    .catch(() => ({}))

  const workPreferences = await replaceWorkPreferences(c.env, member.membership_number, body)
  return c.json({ workPreferences })
})

profilesRouter.post('/me/work-experiences', async (c) => {
  const member = c.get('member')
  const body = await c.req.json<{
    company_name?: string
    title?: string
    location?: string | null
    start_date?: string | null
    end_date?: string | null
    is_current?: boolean
    description?: string | null
    responsibilities?: string | null
    achievements?: string | null
    sort_order?: number
    skills?: SkillInput[]
  }>()

  if (!body.company_name?.trim() || !body.title?.trim()) {
    return c.json({ message: 'اسم الجهة والمسمى الوظيفي مطلوبان' }, 400)
  }

  const workExperience = await createWorkExperience(c.env, member.membership_number, {
    company_name: body.company_name,
    title: body.title,
    location: body.location,
    start_date: body.start_date,
    end_date: body.end_date,
    is_current: body.is_current,
    description: body.description,
    responsibilities: body.responsibilities,
    achievements: body.achievements,
    sort_order: body.sort_order,
  })

  const resolvedSkills = await ensureMemberSkills(
    c.env,
    member.membership_number,
    body.skills || [],
  )
  const skills = await replaceEntitySkills(
    c.env,
    member.membership_number,
    'work_experience',
    workExperience.id,
    resolvedSkills,
  )

  return c.json(
    {
      workExperience: {
        ...workExperience,
        skills: skills.map((s) => ({ skillId: s.skill_id, name: s.skill_name })),
      },
    },
    201,
  )
})

profilesRouter.post('/me/projects', async (c) => {
  const member = c.get('member')
  const body = await c.req.json<{
    name?: string
    role?: string | null
    project_type?: string | null
    company?: string | null
    start_date?: string | null
    end_date?: string | null
    is_ongoing?: boolean
    tools?: string | null
    responsibilities?: string | null
    outcomes?: string | null
    skills?: SkillInput[]
  }>()

  if (!body.name?.trim()) {
    return c.json({ message: 'اسم المشروع مطلوب' }, 400)
  }

  const project = await createProject(c.env, member.membership_number, body)
  const resolvedSkills = await ensureMemberSkills(
    c.env,
    member.membership_number,
    body.skills || [],
  )
  const skills = await replaceEntitySkills(
    c.env,
    member.membership_number,
    'project',
    project.id,
    resolvedSkills,
  )

  return c.json(
    {
      project: {
        ...project,
        skills: skills.map((s) => ({ skillId: s.skill_id, name: s.skill_name })),
      },
    },
    201,
  )
})

profilesRouter.delete('/me/projects/:id', async (c) => {
  const member = c.get('member')
  const id = c.req.param('id')
  const deleted = await deleteProject(c.env, member.membership_number, id)
  if (!deleted) return c.json({ message: 'غير موجود' }, 404)
  await deleteEntitySkills(c.env, 'project', id)
  return c.json({ ok: true })
})

profilesRouter.patch('/me/work-experiences/:id', async (c) => {
  const member = c.get('member')
  const id = c.req.param('id')
  const body = await c.req.json()
  const workExperience = await updateWorkExperience(c.env, member.membership_number, id, body)
  if (!workExperience) return c.json({ message: 'Not found' }, 404)
  return c.json({ workExperience })
})

profilesRouter.delete('/me/work-experiences/:id', async (c) => {
  const member = c.get('member')
  const id = c.req.param('id')
  const deleted = await deleteWorkExperience(c.env, member.membership_number, id)
  if (!deleted) return c.json({ message: 'Not found' }, 404)
  await deleteEntitySkills(c.env, 'work_experience', id)
  return c.json({ ok: true })
})

profilesRouter.post('/me/documents', async (c) => {
  const member = c.get('member')
  const formData = await c.req.formData()
  const fileEntry = formData.get('file')
  const kind = String(formData.get('kind') || 'cv').trim() || 'cv'

  if (!fileEntry || !(fileEntry instanceof File)) {
    return c.json({ message: 'file is required' }, 400)
  }
  if (fileEntry.size > MAX_FILE_SIZE) {
    return c.json({ message: 'File exceeds 10MB limit' }, 400)
  }
  if (!ALLOWED_DOC_TYPES.has(fileEntry.type)) {
    return c.json({ message: 'Unsupported file type' }, 400)
  }

  const id = createId('doc')
  const sanitized = fileEntry.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/--+/g, '-')
  const r2Key = `members/${member.membership_number}/${kind}/${id}-${sanitized}`

  await c.env.CAREER_BUCKET.put(r2Key, await fileEntry.arrayBuffer(), {
    httpMetadata: { contentType: fileEntry.type },
  })

  const document = await createDocument(c.env, member.membership_number, {
    kind,
    file_name: fileEntry.name,
    content_type: fileEntry.type,
    r2_key: r2Key,
    size_bytes: fileEntry.size,
  })

  const { r2_key: _r2, ...safe } = document
  return c.json({ document: safe }, 201)
})

profilesRouter.get('/me/documents/:id/download', async (c) => {
  const member = c.get('member')
  const document = await getDocument(c.env, member.membership_number, c.req.param('id'))
  if (!document) return c.json({ message: 'Not found' }, 404)

  const object = await c.env.CAREER_BUCKET.get(document.r2_key)
  if (!object) return c.json({ message: 'File missing' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': document.content_type,
      'Content-Disposition': `attachment; filename="${document.file_name.replace(/"/g, '')}"`,
    },
  })
})

profilesRouter.delete('/me/documents/:id', async (c) => {
  const member = c.get('member')
  const document = await deleteDocument(c.env, member.membership_number, c.req.param('id'))
  if (!document) return c.json({ message: 'Not found' }, 404)
  await c.env.CAREER_BUCKET.delete(document.r2_key)
  return c.json({ ok: true })
})

profilesRouter.get('/me/access-requests', async (c) => {
  const member = c.get('member')
  const rows = await listOwnerAccessRequests(c.env, member.membership_number)
  const items = []
  for (const row of rows) {
    const requester = await fetchVmsPartnerProfile(c.env, row.requester_membership_number)
    items.push({
      ...row,
      requester: requester
        ? {
            membershipNumber: requester.membershipNumber,
            enName: requester.enName,
            arName: requester.arName,
            email: requester.email,
            profilePictureUrl: requester.profilePictureUrl,
            sex: requester.sex,
            country: requester.country,
            city: requester.city,
          }
        : {
            membershipNumber: row.requester_membership_number,
            enName: null,
            arName: null,
            email: null,
            profilePictureUrl: null,
            sex: null,
            country: null,
            city: null,
          },
    })
  }
  return c.json({
    pending: items.filter((item) => item.status === 'pending'),
    accepted: items.filter((item) => item.status === 'accepted'),
    rejected: items.filter((item) => item.status === 'rejected' || item.status === 'revoked'),
  })
})

profilesRouter.patch('/me/access-requests/:id', async (c) => {
  const member = c.get('member')
  const body = await c.req
    .json<{ status?: 'accepted' | 'rejected' | 'revoked' }>()
    .catch(() => ({}))
  const status = body.status
  if (status !== 'accepted' && status !== 'rejected' && status !== 'revoked') {
    return c.json({ message: 'حالة غير صالحة' }, 400)
  }
  const row = await decideCvAccessRequest(c.env, member.membership_number, c.req.param('id'), status)
  if (!row) return c.json({ message: 'غير موجود' }, 404)
  return c.json({ request: row })
})

/** Browse public CVs (any signed-in VMS member). Payloads are privacy-redacted. */
profilesRouter.get('/discover', async (c) => {
  const actor = c.get('member')
  const q = c.req.query('q') || undefined
  const profiles = await searchPublishedProfiles(c.env, q)
  const enriched = []
  for (const profile of profiles) {
    const isSelf = profile.membership_number === actor.membership_number
    const fullAccess =
      isSelf || (await hasAcceptedCvAccess(c.env, profile.membership_number, actor.membership_number))
    const vmsProfile = await fetchVmsPartnerProfile(c.env, profile.membership_number)
    const work = await listWorkExperiences(c.env, profile.membership_number)
    const workPreferences = await getWorkPreferences(c.env, profile.membership_number)
    const latestRole = work.find((item) => item.is_current)?.title || work[0]?.title || null
    const safeVms = fullAccess
      ? vmsProfile
      : redactVmsProfile(
          vmsProfile
            ? {
                membershipNumber: vmsProfile.membershipNumber,
                enName: vmsProfile.enName,
                arName: vmsProfile.arName,
                educationLevel: vmsProfile.educationLevel,
                school: vmsProfile.school,
                fieldOfStudy: vmsProfile.fieldOfStudy,
                skills: vmsProfile.skills,
                languages: vmsProfile.languages,
                profilePictureUrl: vmsProfile.profilePictureUrl,
                sex: vmsProfile.sex,
                dateOfBirth: vmsProfile.dateOfBirth,
                country: vmsProfile.country,
                region: vmsProfile.region,
                city: vmsProfile.city,
                email: vmsProfile.email,
                phoneNumber: vmsProfile.phoneNumber,
              }
            : null,
        )
    enriched.push({
      profile,
      latestRole,
      workPreferences,
      privacyMode: fullAccess ? 'full' : 'limited',
      vmsProfile: safeVms,
    })
  }
  return c.json({ profiles: enriched })
})

profilesRouter.post('/:membershipNumber/access-requests', async (c) => {
  const actor = c.get('member')
  const membershipNumber = c.req.param('membershipNumber')
  if (membershipNumber === actor.membership_number) {
    return c.json({ message: 'لا يمكن طلب الوصول لسيرتك' }, 400)
  }
  const published = await getPublishedProfile(c.env, membershipNumber)
  if (!published) return c.json({ message: 'السيرة غير متاحة' }, 404)

  const body = await c.req.json<{ message?: string }>().catch(() => ({}))
  const request = await requestCvAccess(
    c.env,
    membershipNumber,
    actor.membership_number,
    body.message,
  )
  return c.json({ request }, request.created_at === request.updated_at ? 201 : 200)
})

profilesRouter.get('/:membershipNumber', async (c) => {
  const actor = c.get('member')
  const membershipNumber = c.req.param('membershipNumber')
  const isSelf = membershipNumber === actor.membership_number

  // Own profile: allow draft preview. Others: published only.
  // Never HTTP-redirect here — browsers drop/strip API base path (/ms/career).
  const profile = isSelf
    ? await ensureCareerProfile(c.env, membershipNumber)
    : await getPublishedProfile(c.env, membershipNumber)
  if (!profile) {
    return c.json({ message: 'Not found' }, 404)
  }

  const accessRow = isSelf
    ? null
    : await getCvAccessBetween(c.env, membershipNumber, actor.membership_number)
  const fullAccess = isSelf || accessRow?.status === 'accepted'
  const accessStatus: CvAccessStatus = isSelf
    ? 'self'
    : accessRow
      ? (accessRow.status as CvAccessStatus)
      : 'none'

  const workExperiences = await attachSkills(
    c.env,
    'work_experience',
    await listWorkExperiences(c.env, membershipNumber),
  )
  const projects = await attachSkills(
    c.env,
    'project',
    await listProjects(c.env, membershipNumber),
  )
  const documents = await listDocuments(c.env, membershipNumber)
  const languageRows = await listProfileLanguages(c.env, membershipNumber)
  const vmsProfile = isSelf
    ? await fetchVmsSelfProfile(c.env, membershipNumber, c.req.header('Authorization'))
    : await fetchVmsPartnerProfile(c.env, membershipNumber)
  const languages = mergeLanguagePreferences(vmsProfile?.languages, languageRows)
  const workPreferences = await getWorkPreferences(c.env, membershipNumber)

  const safeDocs = documents.map(({ r2_key: _r2, ...rest }) => rest)

  return c.json({
    profile,
    workExperiences: fullAccess ? workExperiences : redactWorkExperiences(workExperiences),
    projects: fullAccess ? projects : redactProjects(projects),
    documents: fullAccess
      ? safeDocs.map((doc) => ({ ...doc, downloadable: true }))
      : redactDocuments(safeDocs),
    languages,
    workPreferences,
    vmsProfile: fullAccess ? vmsProfile : redactVmsProfile(vmsProfile),
    privacy: {
      mode: fullAccess ? 'full' : 'limited',
      accessStatus,
      canRequestAccess: !isSelf && accessStatus !== 'accepted' && accessStatus !== 'pending',
      canDownloadDocuments: fullAccess,
    },
  })
})

profilesRouter.get('/:membershipNumber/documents/:id/download', async (c) => {
  const actor = c.get('member')
  const membershipNumber = c.req.param('membershipNumber')
  const documentId = c.req.param('id')

  const isSelf = membershipNumber === actor.membership_number
  if (!isSelf) {
    const published = await getPublishedProfile(c.env, membershipNumber)
    if (!published) return c.json({ message: 'Not found' }, 404)
    const allowed = await hasAcceptedCvAccess(c.env, membershipNumber, actor.membership_number)
    if (!allowed) return c.json({ message: 'غير مصرح بتنزيل الملفات' }, 403)
  }

  const document = await getDocument(c.env, membershipNumber, documentId)
  if (!document) return c.json({ message: 'Not found' }, 404)

  const object = await c.env.CAREER_BUCKET.get(document.r2_key)
  if (!object) return c.json({ message: 'File missing' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': document.content_type,
      'Content-Disposition': `attachment; filename="${document.file_name.replace(/"/g, '')}"`,
    },
  })
})

export default profilesRouter
