import type { Environment } from '../types/env'
import { fetchVmsApi } from '../utils/vms-fetch'

export type VmsProfileSnapshot = {
  membershipNumber: string
  email: string
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  educationLevel: string | null
  school: string | null
  fieldOfStudy: string | null
  graduationYear: number | null
  biography: string | null
  languages: string | null
  skills: string | null
  interests: string | null
  profilePictureUrl: string | null
  city: string | null
  country: string | null
}

type VmsProfileJson = {
  profile?: Partial<VmsProfileSnapshot> & {
    membershipNumber?: string
    email?: string
  }
}

/** Self profile via caller's Bearer token. */
export async function fetchVmsSelfProfile(
  env: Environment,
  membershipNumber: string,
  authorizationHeader: string | undefined,
): Promise<VmsProfileSnapshot | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null
  }
  if (!env.MEMBERSHIP_MS_SERVICE && !env.VMS_API_BASE?.trim()) {
    return null
  }

  try {
    const response = await fetchVmsApi(env, `/profile/${encodeURIComponent(membershipNumber)}`, {
      method: 'GET',
      headers: {
        Authorization: authorizationHeader,
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      console.error('VMS self profile fetch failed', response.status)
      return null
    }
    return mapProfile(await response.json(), membershipNumber)
  } catch (error) {
    console.error('VMS self profile request failed', error)
    return null
  }
}

/** Partner snapshot via X-API-Key (for published candidates / applicants). */
export async function fetchVmsPartnerProfile(
  env: Environment,
  membershipNumber: string,
): Promise<VmsProfileSnapshot | null> {
  const secret = env.VMS_INTERNAL_SECRET?.trim()
  if (!secret) {
    return null
  }
  if (!env.MEMBERSHIP_MS_SERVICE && !env.VMS_API_BASE?.trim()) {
    return null
  }

  try {
    const response = await fetchVmsApi(
      env,
      `/internal/partner/member-profile/${encodeURIComponent(membershipNumber)}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': secret,
          Accept: 'application/json',
        },
      },
    )
    if (!response.ok) {
      console.error('VMS partner profile fetch failed', response.status)
      return null
    }
    return mapProfile(await response.json(), membershipNumber)
  } catch (error) {
    console.error('VMS partner profile request failed', error)
    return null
  }
}

function mapProfile(data: unknown, fallbackMembership: string): VmsProfileSnapshot | null {
  const json = data as VmsProfileJson
  const profile = json.profile
  if (!profile) return null

  return {
    membershipNumber: profile.membershipNumber?.trim() || fallbackMembership,
    email: profile.email?.trim() || '',
    enName: profile.enName ?? null,
    arName: profile.arName ?? null,
    phoneNumber: profile.phoneNumber ?? null,
    sex: profile.sex ?? null,
    educationLevel: profile.educationLevel ?? null,
    school: profile.school ?? null,
    fieldOfStudy: profile.fieldOfStudy ?? null,
    graduationYear: typeof profile.graduationYear === 'number' ? profile.graduationYear : null,
    biography: profile.biography ?? null,
    languages: profile.languages ?? null,
    skills: profile.skills ?? null,
    interests: profile.interests ?? null,
    profilePictureUrl: profile.profilePictureUrl ?? null,
    city: profile.city ?? null,
    country: profile.country ?? null,
  }
}
