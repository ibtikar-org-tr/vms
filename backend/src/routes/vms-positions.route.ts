import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getUserDisplayNamesByMembershipNumbers, getUserProfileByMembershipNumber } from '../repositories/user-info.repository'
import { createProjectMember, getProjectMember } from '../repositories/vms-project-members.repository'
import {
  createPosition,
  createPositionApplication,
  deletePosition,
  deletePositionApplicationById,
  getPositionApplicationById,
  getPositionById,
  getPositionByIdWithApplications,
  listOpenPositions,
  listProjectPositions,
  syncPositionAfterReview,
  updatePosition,
  updatePositionApplication,
} from '../repositories/vms-positions.repository'
import {
  createPositionApplicationSchema,
  createPositionSchema,
  positionApplicationParamsSchema,
  positionParamsSchema,
  reviewPositionApplicationSchema,
  updatePositionSchema,
} from '../schemas/vms-position.schema'
import {
  notifyManagerAboutAcceptedApplicant,
  notifyPositionApplicationReviewed,
  notifyPositionApplicationSubmitted,
} from '../services/position-notification.service'
import { sendBackendTelegramGroupInvite } from '../services/telegram-notification.service'
import type { AppBindings } from '../types/bindings'
import type { AppEnv } from '../types/hono'
import { getActorMembershipNumber } from '../utils/actor'
import { canManageProject, isProjectMember } from '../utils/project-access'

export const vmsPositionsRoute = new Hono<AppEnv>()

async function canManageProjectPositions(db: AppBindings['VMS_DB'], projectId: string, membershipNumber: string) {
  return canManageProject(db, projectId, membershipNumber)
}

async function canAccessProjectPositions(db: AppBindings['VMS_DB'], projectId: string, membershipNumber: string) {
  const access = await isProjectMember(db, projectId, membershipNumber)
  return { project: access.project, isAuthorized: access.isMember }
}

async function enrichPositionsWithDisplayNames(
  membersDb: AppBindings['MEMBERS_DB'],
  positions: Awaited<ReturnType<typeof listProjectPositions>>,
) {
  const membershipNumbers = new Set<string>()

  for (const position of positions) {
    membershipNumbers.add(position.createdBy)
    for (const application of position.applications) {
      membershipNumbers.add(application.membershipNumber)
      if (application.reviewedBy) {
        membershipNumbers.add(application.reviewedBy)
      }
    }
  }

  const displayNameMap = await getUserDisplayNamesByMembershipNumbers(membersDb, Array.from(membershipNumbers))

  return positions.map((position) => ({
    ...position,
    createdByDisplayName: displayNameMap.get(position.createdBy) ?? position.createdBy,
    applications: position.applications.map((application) => ({
      ...application,
      displayName: displayNameMap.get(application.membershipNumber) ?? application.membershipNumber,
      reviewedByDisplayName: application.reviewedBy ? displayNameMap.get(application.reviewedBy) ?? application.reviewedBy : null,
    })),
  }))
}

vmsPositionsRoute.get('/positions', async (c) => {
  try {
    const membershipNumber = getActorMembershipNumber(c)
    const projectId = c.req.query('projectId')?.trim()

    if (!membershipNumber) {
      return c.json({ error: 'Membership number is required.' }, 400)
    }

    let positions: Awaited<ReturnType<typeof listProjectPositions | typeof listOpenPositions>>

    if (projectId) {
      const access = await canAccessProjectPositions(c.env.VMS_DB, projectId, membershipNumber)
      if (!access.project) {
        return c.json({ error: 'Project not found.' }, 404)
      }

      if (!access.isAuthorized) {
        return c.json({ error: 'You do not have access to this project.' }, 403)
      }

      positions = await listProjectPositions(c.env.VMS_DB, projectId)
    } else {
      positions = await listOpenPositions(c.env.VMS_DB)
    }

    const enriched = await enrichPositionsWithDisplayNames(c.env.MEMBERS_DB, positions)
    return c.json({ positions: enriched })
  } catch (error) {
    console.error('Failed to list positions', error)
    return c.json({ error: 'Could not fetch positions.' }, 500)
  }
})

vmsPositionsRoute.get('/positions/:id', zValidator('param', positionParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const membershipNumber = getActorMembershipNumber(c)


    const position = await getPositionByIdWithApplications(c.env.VMS_DB, id)
    if (!position) {
      return c.json({ error: 'Position not found.' }, 404)
    }

    const access = await canAccessProjectPositions(c.env.VMS_DB, position.projectId, membershipNumber)
    if (!access.project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    if (!access.isAuthorized) {
      return c.json({ error: 'You do not have access to this project.' }, 403)
    }

    const enriched = await enrichPositionsWithDisplayNames(c.env.MEMBERS_DB, [position])

    return c.json({ position: enriched[0] })
  } catch (error) {
    console.error('Failed to fetch position', error)
    return c.json({ error: 'Could not fetch position.' }, 500)
  }
})

vmsPositionsRoute.post('/positions', zValidator('json', createPositionSchema), async (c) => {
  try {
    const actorMembershipNumber = getActorMembershipNumber(c)
    if (!actorMembershipNumber) {
      return c.json({ error: 'Membership number is required.' }, 400)
    }

    const payload = c.req.valid('json')
    if (payload.createdBy !== actorMembershipNumber) {
      return c.json({ error: 'You can only create positions for yourself.' }, 403)
    }

    const authorization = await canManageProjectPositions(c.env.VMS_DB, payload.projectId, actorMembershipNumber)
    if (!authorization.project) {
      return c.json({ error: 'Project not found.' }, 404)
    }

    if (!authorization.isAuthorized) {
      return c.json({ error: 'Only project owner or managers can create positions.' }, 403)
    }

    const position = await createPosition(c.env.VMS_DB, payload)
    if (!position) {
      return c.json({ error: 'Could not create position.' }, 500)
    }

    const enriched = await enrichPositionsWithDisplayNames(c.env.MEMBERS_DB, [
      {
        ...position,
        acceptedApplicationsCount: 0,
        applications: [],
      },
    ])

    return c.json({ position: enriched[0] }, 201)
  } catch (error) {
    console.error('Failed to create position', error)
    return c.json({ error: 'Could not create position.' }, 500)
  }
})

vmsPositionsRoute.put(
  '/positions/:id',
  zValidator('param', positionParamsSchema),
  zValidator('json', updatePositionSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)


      const position = await getPositionById(c.env.VMS_DB, id)
      if (!position) {
        return c.json({ error: 'Position not found.' }, 404)
      }

      const authorization = await canManageProjectPositions(c.env.VMS_DB, position.projectId, actorMembershipNumber)
      if (!authorization.isAuthorized) {
        return c.json({ error: 'Only project owner or managers can update positions.' }, 403)
      }

      const updated = await updatePosition(c.env.VMS_DB, id, c.req.valid('json'))
      if (!updated) {
        return c.json({ error: 'Could not update position.' }, 500)
      }

      const enriched = await enrichPositionsWithDisplayNames(c.env.MEMBERS_DB, [
        {
          ...updated,
          acceptedApplicationsCount: 0,
          applications: [],
        },
      ])

      return c.json({ position: enriched[0] })
    } catch (error) {
      console.error('Failed to update position', error)
      return c.json({ error: 'Could not update position.' }, 500)
    }
  },
)

vmsPositionsRoute.delete('/positions/:id', zValidator('param', positionParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const actorMembershipNumber = getActorMembershipNumber(c)


    const position = await getPositionById(c.env.VMS_DB, id)
    if (!position) {
      return c.json({ error: 'Position not found.' }, 404)
    }

    const authorization = await canManageProjectPositions(c.env.VMS_DB, position.projectId, actorMembershipNumber)
    if (!authorization.isAuthorized) {
      return c.json({ error: 'Only project owner or managers can delete positions.' }, 403)
    }

    const deleted = await deletePosition(c.env.VMS_DB, id)
    if (!deleted) {
      return c.json({ error: 'Position not found.' }, 404)
    }

    return c.json({ message: 'Position deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete position', error)
    return c.json({ error: 'Could not delete position.' }, 500)
  }
})

vmsPositionsRoute.post(
  '/positions/:id/applications',
  zValidator('param', positionParamsSchema),
  zValidator('json', createPositionApplicationSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const membershipNumber = getActorMembershipNumber(c)


      const position = await getPositionById(c.env.VMS_DB, id)
      if (!position) {
        return c.json({ error: 'Position not found.' }, 404)
      }

      if (position.status !== 'open') {
        return c.json({ error: 'This position is not open for applications.' }, 400)
      }

      const application = await createPositionApplication(c.env.VMS_DB, {
        positionId: id,
        membershipNumber,
        ...c.req.valid('json'),
      })

      if (!application) {
        return c.json({ error: 'You have already applied to this position.' }, 409)
      }

      const displayNameMap = await getUserDisplayNamesByMembershipNumbers(c.env.MEMBERS_DB, [membershipNumber, position.createdBy])

      await notifyPositionApplicationSubmitted(c.env, {
        frontendBaseUrl: c.env.FRONTEND_BASE_URL,
        projectId: position.projectId,
        projectName: position.projectName,
        positionId: position.id,
        positionName: position.name,
        applicantMembershipNumber: membershipNumber,
        applicantDisplayName: displayNameMap.get(membershipNumber) ?? membershipNumber,
        ownerMembershipNumber: position.createdBy,
      })

      return c.json(
        {
          positionApplication: {
            ...application,
            displayName: displayNameMap.get(membershipNumber) ?? membershipNumber,
            reviewedByDisplayName: null,
          },
        },
        201,
      )
    } catch (error) {
      console.error('Failed to create position application', error)
      return c.json({ error: 'Could not create application.' }, 500)
    }
  },
)

vmsPositionsRoute.post(
  '/position-applications/:id/self-cancel',
  zValidator('param', positionApplicationParamsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)

      if (!actorMembershipNumber) {
        return c.json({ error: 'Membership number is required.' }, 400)
      }

      const application = await getPositionApplicationById(c.env.VMS_DB, id)
      if (!application) {
        return c.json({ error: 'الطلب غير موجود.' }, 404)
      }

      if (application.membershipNumber !== actorMembershipNumber) {
        return c.json({ error: 'يمكنك إلغاء طلبك فقط.' }, 403)
      }

      if (application.status !== 'pending') {
        return c.json({ error: 'يمكن إلغاء الطلبات قيد المراجعة فقط.' }, 400)
      }

      const deleted = await deletePositionApplicationById(c.env.VMS_DB, id)
      if (!deleted) {
        return c.json({ error: 'الطلب غير موجود.' }, 404)
      }

      return c.json({ message: 'تم إلغاء طلب التطوع بنجاح.' })
    } catch (error) {
      console.error('Failed to self-cancel position application', error)
      return c.json({ error: 'تعذر إلغاء طلب التطوع.' }, 500)
    }
  },
)

vmsPositionsRoute.put(
  '/position-applications/:id',
  zValidator('param', positionApplicationParamsSchema),
  zValidator('json', reviewPositionApplicationSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const actorMembershipNumber = getActorMembershipNumber(c)


      const existing = await getPositionApplicationById(c.env.VMS_DB, id)
      if (!existing) {
        return c.json({ error: 'Application not found.' }, 404)
      }

      const position = await getPositionById(c.env.VMS_DB, existing.positionId)
      if (!position) {
        return c.json({ error: 'Position not found.' }, 404)
      }

      const authorization = await canManageProjectPositions(c.env.VMS_DB, position.projectId, actorMembershipNumber)
      if (!authorization.isAuthorized) {
        return c.json({ error: 'Only project owner or managers can review applications.' }, 403)
      }

      const updated = await updatePositionApplication(c.env.VMS_DB, id, {
        ...c.req.valid('json'),
        reviewedBy: actorMembershipNumber,
      })

      if (!updated) {
        return c.json({ error: 'Could not update application.' }, 500)
      }

      let groupInviteSent = false

      if (updated.status === 'accepted') {
        const existingMember = await getProjectMember(c.env.VMS_DB, position.projectId, updated.membershipNumber)
        if (!existingMember) {
          await createProjectMember(c.env.VMS_DB, {
            projectId: position.projectId,
            membershipNumber: updated.membershipNumber,
            role: 'member',
          })
        }

        const projectTelegramGroupId = authorization.project?.telegramGroupId?.trim()
        if (projectTelegramGroupId) {
          try {
            const inviteResult = await sendBackendTelegramGroupInvite(c.env, {
              membershipNumber: updated.membershipNumber,
              telegramGroupId: projectTelegramGroupId,
              contextLabel: `project ${authorization.project?.name ?? position.projectId}`,
            })

            groupInviteSent = inviteResult.success

            if (!inviteResult.success) {
              console.warn('Failed to send project group invite after position acceptance:', inviteResult)
            }
          } catch (inviteError) {
            console.warn('Project group invite threw after position acceptance:', inviteError)
          }
        }
      }

      const positionWithApplications = await syncPositionAfterReview(c.env.VMS_DB, position.id)
      if (!positionWithApplications) {
        return c.json({ error: 'Could not update position.' }, 500)
      }

      const enriched = await enrichPositionsWithDisplayNames(c.env.MEMBERS_DB, [positionWithApplications])
      const displayNameMap = await getUserDisplayNamesByMembershipNumbers(c.env.MEMBERS_DB, [
        updated.membershipNumber,
        updated.reviewedBy ?? actorMembershipNumber,
      ])

      await notifyPositionApplicationReviewed(c.env, {
        frontendBaseUrl: c.env.FRONTEND_BASE_URL,
        projectId: position.projectId,
        projectName: position.projectName,
        positionId: position.id,
        positionName: position.name,
        applicantMembershipNumber: updated.membershipNumber,
        decision: updated.status,
      })

      if (updated.status === 'accepted') {
        const applicantProfile = await getUserProfileByMembershipNumber(c.env.MEMBERS_DB, updated.membershipNumber)

        await notifyManagerAboutAcceptedApplicant(c.env, {
          frontendBaseUrl: c.env.FRONTEND_BASE_URL,
          projectId: position.projectId,
          projectName: position.projectName,
          positionId: position.id,
          positionName: position.name,
          managerMembershipNumber: actorMembershipNumber,
          applicantMembershipNumber: updated.membershipNumber,
          applicantDisplayName:
            displayNameMap.get(updated.membershipNumber) ?? updated.membershipNumber,
          applicantContact: {
            telegramId: applicantProfile?.telegramId ?? null,
            telegramUsername: applicantProfile?.telegramUsername ?? null,
            email: applicantProfile?.email ?? null,
            phoneNumber: applicantProfile?.phoneNumber ?? null,
          },
          groupInviteSent,
        })
      }

      return c.json({
        position: enriched[0],
        positionApplication: {
          ...updated,
          displayName: displayNameMap.get(updated.membershipNumber) ?? updated.membershipNumber,
          reviewedByDisplayName:
            displayNameMap.get(updated.reviewedBy ?? actorMembershipNumber) ?? updated.reviewedBy ?? actorMembershipNumber,
        },
      })
    } catch (error) {
      console.error('Failed to review position application', error)
      return c.json({ error: 'Could not review application.' }, 500)
    }
  },
)