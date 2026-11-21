import type { Environment } from '../types/env'
import { fetchVmsApi } from '../utils/vms-fetch'

export type VmsProfileSnapshot = {
  membershipNumber: string
  email: string
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  dateOfBirth: string | null
  educationLevel: string | null
  school: string | null
  fieldOfStudy: string | null
  graduationYear: number | null
  biography: string | null
  languages: string | null
  skills: string | null
  interests: string | null
  profilePictureUrl: string | null
  country: string | null
  region: string | null
  city: string | null
  /** Platform key → URL (null means present but privacy-redacted). */
  socialMediaLinks: Record<string, string | null> | null
}

type VmsProfileJson = {
  profile?: Partial<VmsProfileSnapshot> & {
    membershipNumber?: string
    email?: string
    dateOfBirth?: string | null
    region?: string | null
    socialMediaLinks?: string | Record<string, unknown> | null
  }
}

function parseSocialMediaLinks(
  raw: string | Record<string, unknown> | null | undefined,
): Record<string, string | null> | null {
  if (raw == null) return null
  let source: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      source = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null

  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const platform = key.trim().toLowerCase()
    if (!platform) continue
    let url: string | null = null
    if (typeof value === 'string') {
      url = value.trim() || null
    } else if (value && typeof value === 'object' && 'url' in value) {
      url = String((value as { url?: unknown }).url || '').trim() || null
    }
    // Only keep linked platforms (non-empty URL). Privacy redact later strips URLs but keeps keys.
    if (url) out[platform] = url
  }
  return Object.keys(out).length ? out : null
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
    dateOfBirth: profile.dateOfBirth?.trim() || null,
    educationLevel: profile.educationLevel ?? null,
    school: profile.school ?? null,
    fieldOfStudy: profile.fieldOfStudy ?? null,
    graduationYear: typeof profile.graduationYear === 'number' ? profile.graduationYear : null,
    biography: profile.biography ?? null,
    languages: profile.languages ?? null,
    skills: profile.skills ?? null,
    interests: profile.interests ?? null,
    profilePictureUrl: profile.profilePictureUrl ?? null,
    country: profile.country ?? null,
    region: profile.region ?? null,
    city: profile.city ?? null,
    socialMediaLinks: parseSocialMediaLinks(profile.socialMediaLinks),
  }
}
