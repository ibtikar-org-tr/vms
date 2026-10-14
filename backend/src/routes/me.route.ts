import { Hono } from 'hono'
import {
  listMemberAcceptedPositions,
  listMemberProjectAffiliations,
} from '../repositories/vms-member-title.repository'
import type { AppEnv } from '../types/hono'
import { getActorUser } from '../utils/actor'
import { resolveMemberDisplayTitle } from '../utils/member-display-title'

export const meRoute = new Hono<AppEnv>()

meRoute.get('/me/display-title', async (c) => {
  try {
    const actor = getActorUser(c)
    const [affiliations, positions] = await Promise.all([
      listMemberProjectAffiliations(c.env.VMS_DB, actor.membershipNumber),
      listMemberAcceptedPositions(c.env.VMS_DB, actor.membershipNumber),
    ])

    return c.json(resolveMemberDisplayTitle(affiliations, positions, actor.role))
  } catch (error) {
    console.error('Failed to resolve member display title', error)
    return c.json({ error: 'Could not resolve member title.' }, 500)
  }
})
