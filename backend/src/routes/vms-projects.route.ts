import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getUserByMembershipNumber } from '../repositories/users.repository'
import { getUserDisplayNamesByMembershipNumbers } from '../repositories/user-info.repository'
import {
  createProject,
  deleteProjectById,
  getDirectProjectByIdForMember,
  getProjectById,
  listAllProjectsPublic,
  listDirectProjectsForMember,
  listProjectsForMember,
  listProjectsForMemberWithRedactedNames,
  updateProjectById,
} from '../repositories/vms-projects.repository'
import { getProjectMember, upsertProjectMember } from '../repositories/vms-project-members.repository'
import { createProjectSchema, projectParamsSchema, updateProjectSchema } from '../schemas/vms-project.schema'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber, getActorUser } from '../utils/actor'
import { isAssemblyLeadership } from '../utils/assembly-leadership'
import { canManageProject } from '../utils/project-access'

export const vmsProjectsRoute = new Hono<AppEnv>()

vmsProjectsRoute.get('/projects', async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const leadership = await isAssemblyLeadership(c.env.VMS_DB, getActorUser(c))

    // Full member-visible tree including completed/archived (used by sub-projects pages).
    const projects = leadership
      ? await listAllProjectsPublic(c.env.VMS_DB)
      : await listProjectsForMember(c.env.VMS_DB, membershipNumber)
    return c.json({ projects })
  } catch (error) {
    console.error('Failed to list projects', error)
    return c.json({ error: 'Could not fetch projects.' }, 500)
  }
})

vmsProjectsRoute.get('/projects/direct', async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const leadership = await isAssemblyLeadership(c.env.VMS_DB, getActorUser(c))

    // Main projects list: active only; use GET /projects for sub-project trees that need inactive ones.
    const projects = leadership
      ? await listAllProjectsPublic(c.env.VMS_DB, { activeOnly: true })
      : await listDirectProjectsForMember(c.env.VMS_DB, membershipNumber, {
          activeOnly: true,
        })
    const displayNameMap = await getUserDisplayNamesByMembershipNumbers(
      c.env.MEMBERS_DB,
      projects.map((project) => project.owner),
    )

    return c.json({
      projects: projects.map((project) => ({
        ...project,
        ownerDisplayName: displayNameMap.get(project.owner) ?? project.owner,
      })),
    })
  } catch (error) {
    console.error('Failed to list direct projects', error)
    return c.json({ error: 'Could not fetch direct projects.' }, 500)
  }
})

vmsProjectsRoute.get('/projects/platform', async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const leadership = await isAssemblyLeadership(c.env.VMS_DB, getActorUser(c))

    const projects = leadership
      ? await listAllProjectsPublic(c.env.VMS_DB, { activeOnly: true })
      : await listProjectsForMemberWithRedactedNames(c.env.VMS_DB, membershipNumber, {
          activeOnly: true,
        })
    const displayNameMap = await getUserDisplayNamesByMembershipNumbers(
      c.env.MEMBERS_DB,
      projects.map((project) => project.owner),
    )

    return c.json({
      projects: projects.map((project) => ({
        ...project,
        ownerDisplayName: displayNameMap.get(project.owner) ?? project.owner,
      })),
    })
  } catch (error) {
    console.error('Failed to list platform projects', error)
    return c.json({ error: 'Could not fetch platform projects.' }, 500)
  }
})

vmsProjectsRoute.get('/projects/:id', zValidator('param', projectParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)
    const leadership = await isAssemblyLeadership(c.env.VMS_DB, getActorUser(c))

    const project = leadership
      ? await getProjectById(c.env.VMS_DB, id)
      : await getDirectProjectByIdForMember(c.env.VMS_DB, id, membershipNumber)

    if (!project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    return c.json({ project })
  } catch (error) {
    console.error('Failed to fetch project', error)
    return c.json({ error: 'Could not fetch project.' }, 500)
  }
})

vmsProjectsRoute.post('/projects', zValidator('json', createProjectSchema), async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)

    const payload = c.req.valid('json')

    if (payload.owner.trim() !== membershipNumber) {
      return c.json({ error: 'يجب أن يطابق المالك رقم عضويتك.' }, 403)
    }

    const actor = await getUserByMembershipNumber(c.env.MEMBERS_DB, membershipNumber)

    if (!actor) {
      return c.json({ error: 'Could not create project.' }, 404)
    }

    const parentId = payload.parentProjectId?.trim()
    const isAdmin = actor.role.trim().toLowerCase() === 'admin'

    if (!parentId) {
      if (!isAdmin) {
        return c.json({ error: 'يُسمح للمسؤولين فقط بإنشاء مشاريع رئيسية (بدون مشروع أب).' }, 403)
      }
    } else {
      const parentAccess = await canManageProject(c.env.VMS_DB, parentId, membershipNumber)

      if (!parentAccess.project) {
        return c.json({ error: 'المشروع الأب غير موجود.' }, 404)
      }

      if (!isAdmin && !parentAccess.isAuthorized) {
        return c.json({ error: 'يُسمح لمالك المشروع أو المدراء فقط بإضافة مشاريع فرعية.' }, 403)
      }
    }

    const projectId = crypto.randomUUID()
    const project = await createProject(c.env.VMS_DB, projectId, payload)

    if (!project) {
      return c.json({ error: 'Could not create project.' }, 500)
    }

    await upsertProjectMember(c.env.VMS_DB, {
      projectId,
      membershipNumber: project.owner,
      role: 'owner',
    })

    return c.json({ project }, 201)
  } catch (error) {
    console.error('Failed to create project', error)
    return c.json({ error: 'Could not create project.' }, 500)
  }
})

vmsProjectsRoute.put(
  '/projects/:id',
  zValidator('param', projectParamsSchema),
  zValidator('json', updateProjectSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)

      const payload = c.req.valid('json')
      const authorization = await canManageProject(c.env.VMS_DB, id, membershipNumber)
      if (!authorization.project) {
        return c.json({ error: 'Project not found.' }, 404)
      }

      const projectBefore = authorization.project
      let bodyForUpdate = { ...payload }

      if (payload.owner !== undefined) {
        if (projectBefore.owner !== membershipNumber) {
          return c.json({ error: 'فقط مالك المشروع يمكنه نقل الملكية.' }, 403)
        }

        const nextOwner = payload.owner.trim()

        if (nextOwner === projectBefore.owner) {
          const { owner: _removed, ...rest } = bodyForUpdate
          bodyForUpdate = rest
        } else {
          const nextOwnerMembership = await getProjectMember(c.env.VMS_DB, id, nextOwner)
          if (!nextOwnerMembership) {
            return c.json({ error: 'يجب أن يكون المالك الجديد عضوًا مسجّلًا في المشروع.' }, 400)
          }
        }
      }

      if (!authorization.isAuthorized) {
        return c.json({ error: 'Only project owner or managers can update project settings.' }, 403)
      }

      const transferringTo =
        bodyForUpdate.owner !== undefined ? bodyForUpdate.owner.trim() : null

      const project = await updateProjectById(c.env.VMS_DB, id, bodyForUpdate)

      if (transferringTo && transferringTo !== projectBefore.owner) {
        await upsertProjectMember(c.env.VMS_DB, {
          projectId: id,
          membershipNumber: transferringTo,
          role: 'owner',
        })
        await upsertProjectMember(c.env.VMS_DB, {
          projectId: id,
          membershipNumber: projectBefore.owner,
          role: 'manager',
        })
      }

      return c.json({ project })
    } catch (error) {
      console.error('Failed to update project', error)
      return c.json({ error: 'Could not update project.' }, 500)
    }
  },
)

vmsProjectsRoute.delete('/projects/:id', zValidator('param', projectParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const deleted = await deleteProjectById(c.env.VMS_DB, id)

    if (!deleted) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    return c.json({ message: 'Project deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete project', error)
    return c.json({ error: 'Could not delete project.' }, 500)
  }
})
