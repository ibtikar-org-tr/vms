import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import {
  createAssemblyAnnouncement,
  getAssemblyAnnouncementById,
  isMissingAnnouncementsTable,
  listAssemblyAnnouncements,
} from '../repositories/assembly-announcements.repository'
import {
  countAssemblyDirectory,
  listAssemblyEmailRecipients,
  listAssemblyMembers,
  listAssemblyMembersForExport,
  listAssemblyTelegramMembershipNumbers,
} from '../repositories/assembly-members.repository'
import {
  listProjectNamesByMembershipNumbers,
} from '../repositories/vms-project-members.repository'
import {
  assemblyAnnouncementParamsSchema,
  assemblyMembersQuerySchema,
  createAssemblyAnnouncementSchema,
} from '../schemas/assembly.schema'
import {
  announcementNeedsContinue,
  deliverAssemblyAnnouncement,
} from '../services/assembly-announcement.service'
import type { AppEnv } from '../types/hono'
import { getActorUser } from '../utils/actor'
import { isAssemblyLeadership } from '../utils/assembly-leadership'
import { asciiDownloadFilename, toCsv } from '../utils/csv'
import { generateId } from '../utils/id'
import { jsonValidationHook } from '../utils/zod-json-error'

export const assemblyRoute = new Hono<AppEnv>()

async function requireLeadership(c: Context<AppEnv>) {
  const actor = getActorUser(c)
  const allowed = await isAssemblyLeadership(c.env.VMS_DB, actor)
  if (!allowed) {
    return {
      actor,
      error: {
        body: { error: 'هذه الصفحة متاحة لرئيس مجلس الإدارة ومدير المنصة فقط.' },
        status: 403 as const,
      },
    }
  }

  return { actor, error: null }
}

function volunteeringLabel(value: string | null) {
  if (value === 'yes') return 'نعم'
  if (value === 'maybe') return 'ربما'
  if (value === 'no') return 'لا'
  return value?.trim() || '—'
}

assemblyRoute.get('/assembly/access', async (c) => {
  try {
    const actor = getActorUser(c)
    const isLeadership = await isAssemblyLeadership(c.env.VMS_DB, actor)
    return c.json({ isAssemblyLeadership: isLeadership })
  } catch (error) {
    console.error('Failed to resolve assembly access', error)
    return c.json({ error: 'Could not resolve assembly access.' }, 500)
  }
})

assemblyRoute.get('/assembly/members', zValidator('query', assemblyMembersQuerySchema), async (c) => {
  const access = await requireLeadership(c)
  if (access.error) {
    return c.json(access.error.body, access.error.status)
  }

  try {
    const query = c.req.valid('query')
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 40
    const volunteersOnly = query.volunteersOnly === 'true'
    const [directory, counts] = await Promise.all([
      listAssemblyMembers(c.env.MEMBERS_DB, {
        query: query.q,
        volunteersOnly,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      countAssemblyDirectory(c.env.MEMBERS_DB),
    ])

    const projectNames = await listProjectNamesByMembershipNumbers(
      c.env.VMS_DB,
      directory.members.map((member) => member.membershipNumber),
    )

    return c.json({
      members: directory.members.map((member) => ({
        ...member,
        displayName: member.arName?.trim() || member.enName?.trim() || member.membershipNumber,
        volunteeringLabel: volunteeringLabel(member.interestInVolunteering),
        isVolunteer: ['yes', 'maybe'].includes((member.interestInVolunteering ?? '').toLowerCase()),
        projects: projectNames.get(member.membershipNumber) ?? [],
      })),
      total: directory.total,
      page,
      pageSize,
      counts,
    })
  } catch (error) {
    console.error('Failed to list assembly members', error)
    return c.json({ error: 'تعذر تحميل قائمة الأعضاء.' }, 500)
  }
})

assemblyRoute.get('/assembly/members/export', zValidator('query', assemblyMembersQuerySchema), async (c) => {
  const access = await requireLeadership(c)
  if (access.error) {
    return c.json(access.error.body, access.error.status)
  }

  try {
    const query = c.req.valid('query')
    const members = await listAssemblyMembersForExport(c.env.MEMBERS_DB, {
      query: query.q,
      volunteersOnly: query.volunteersOnly === 'true',
    })
    const projectNames = await listProjectNamesByMembershipNumbers(
      c.env.VMS_DB,
      members.map((member) => member.membershipNumber),
    )

    const csv = toCsv(
      [
        'رقم العضوية',
        'الاسم العربي',
        'الاسم الإنجليزي',
        'البريد',
        'الهاتف',
        'الدولة',
        'المدينة',
        'الجامعة',
        'التخصص',
        'تيليغرام',
        'الاهتمام بالتطوع',
        'المشاريع',
        'تاريخ الانتساب',
      ],
      members.map((member) => [
        member.membershipNumber,
        member.arName,
        member.enName,
        member.email,
        member.phoneNumber,
        member.country,
        member.city,
        member.school,
        member.fieldOfStudy,
        member.telegramUsername,
        volunteeringLabel(member.interestInVolunteering),
        (projectNames.get(member.membershipNumber) ?? []).join('، '),
        member.createdAt,
      ]),
    )

    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiDownloadFilename('assembly-members', 'csv')}"`,
    })
  } catch (error) {
    console.error('Failed to export assembly members', error)
    return c.json({ error: 'تعذر تصدير قائمة الأعضاء.' }, 500)
  }
})

assemblyRoute.get('/assembly/announcements', async (c) => {
  const access = await requireLeadership(c)
  if (access.error) {
    return c.json(access.error.body, access.error.status)
  }

  try {
    const announcements = await listAssemblyAnnouncements(c.env.VMS_DB)
    return c.json({ announcements })
  } catch (error) {
    if (isMissingAnnouncementsTable(error)) {
      return c.json({ announcements: [] })
    }
    console.error('Failed to list assembly announcements', error)
    return c.json({ error: 'تعذر تحميل الرسائل السابقة.' }, 500)
  }
})

assemblyRoute.post(
  '/assembly/announcements',
  zValidator('json', createAssemblyAnnouncementSchema, jsonValidationHook),
  async (c) => {
    const access = await requireLeadership(c)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const payload = c.req.valid('json')
      const created = await createAssemblyAnnouncement(c.env.VMS_DB, {
        id: generateId(),
        createdBy: access.actor.membershipNumber,
        subject: payload.subject,
        body: payload.body,
        sendEmail: payload.sendEmail !== false,
        sendTelegram: payload.sendTelegram !== false,
      })

      if (!created) {
        return c.json({ error: 'تعذر إنشاء الرسالة.' }, 500)
      }

      const announcement = await deliverAssemblyAnnouncement(c.env, created.id)
      const needsContinue = announcement ? await announcementNeedsContinue(c.env, announcement) : false
      const [emailRecipients, telegramRecipients] = await Promise.all([
        listAssemblyEmailRecipients(c.env.MEMBERS_DB),
        listAssemblyTelegramMembershipNumbers(c.env.MEMBERS_DB),
      ])

      return c.json(
        {
          announcement,
          needsContinue,
          audience: {
            email: emailRecipients.length,
            telegram: telegramRecipients.length,
          },
        },
        201,
      )
    } catch (error) {
      if (isMissingAnnouncementsTable(error)) {
        return c.json({ error: 'جدول الرسائل غير جاهز بعد. أعد المحاولة بعد دقائق.' }, 503)
      }
      console.error('Failed to create assembly announcement', error)
      return c.json({ error: 'تعذر إرسال الرسالة.' }, 500)
    }
  },
)

assemblyRoute.post(
  '/assembly/announcements/:id/continue',
  zValidator('param', assemblyAnnouncementParamsSchema),
  async (c) => {
    const access = await requireLeadership(c)
    if (access.error) {
      return c.json(access.error.body, access.error.status)
    }

    try {
      const { id } = c.req.valid('param')
      const existing = await getAssemblyAnnouncementById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'الرسالة غير موجودة.' }, 404)
      }

      const announcement = await deliverAssemblyAnnouncement(c.env, id, { emailOnly: true })
      const needsContinue = announcement ? await announcementNeedsContinue(c.env, announcement) : false
      return c.json({ announcement, needsContinue })
    } catch (error) {
      console.error('Failed to continue assembly announcement', error)
      return c.json({ error: 'تعذر متابعة الإرسال.' }, 500)
    }
  },
)
