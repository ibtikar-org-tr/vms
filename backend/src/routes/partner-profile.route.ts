import { Hono } from 'hono'
import { getUserProfileByMembershipNumber } from '../repositories/user-info.repository'
import { hydrateProfileSkills } from '../services/member-skills-profile.service'
import type { AppBindings } from '../types/bindings'

/**
 * Internal partner API for satellite apps (e.g. Career).
 * Authenticated with X-API-Key = INTERNAL_SECRET.
 * Returns a career-safe member snapshot (no passwords / sensitive internals).
 */
export const partnerProfileRoute = new Hono<{ Bindings: AppBindings }>()

partnerProfileRoute.get('/internal/partner/member-profile/:membershipNumber', async (c) => {
  const apiKey = c.req.header('X-API-Key')?.trim()
  const expected = c.env.INTERNAL_SECRET?.trim()
  if (!expected || apiKey !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const membershipNumber = c.req.param('membershipNumber')?.trim()
  if (!membershipNumber) {
    return c.json({ error: 'membershipNumber is required' }, 400)
  }

  try {
    const profile = await getUserProfileByMembershipNumber(c.env.MEMBERS_DB, membershipNumber)
    if (!profile) {
      return c.json({ error: 'Profile not found.' }, 404)
    }

    const skillFields = await hydrateProfileSkills(c.env.MEMBERS_DB, c.env.VMS_DB, membershipNumber)

    return c.json({
      profile: {
        membershipNumber: profile.membershipNumber,
        email: profile.email,
        enName: profile.enName,
        arName: profile.arName,
        phoneNumber: profile.phoneNumber,
        sex: profile.sex,
        dateOfBirth: profile.dateOfBirth,
        educationLevel: profile.educationLevel,
        school: profile.school,
        fieldOfStudy: profile.fieldOfStudy,
        graduationYear: profile.graduationYear,
        biography: profile.biography,
        languages: profile.languages,
        skills: skillFields.skills,
        interests: skillFields.interests,
        profilePictureUrl: profile.profilePictureUrl,
        country: profile.country,
        region: profile.region,
        city: profile.city,
        socialMediaLinks: profile.socialMediaLinks,
      },
    })
  } catch (error) {
    console.error('Failed to fetch partner member profile', error)
    return c.json({ error: 'Could not fetch profile.' }, 500)
  }
})
