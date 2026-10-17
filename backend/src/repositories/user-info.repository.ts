import type { D1DatabaseLike } from '../types/bindings'
import type { CreateUserInfoParams } from '../schemas/user.schemas'

interface UserProfileRow {
  membershipNumber: string
  email: string
  role: string
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  dateOfBirth: string | null
  country: string | null
  region: string | null
  city: string | null
  address: string | null
  educationLevel: string | null
  school: string | null
  fieldOfStudy: string | null
  graduationYear: number | null
  bloodType: string | null
  telegramId: string | null
  telegramUsername: string | null
  socialMediaLinks: string | null
  profilePictureUrl: string | null
  biography: string | null
  languages: string | null
}

export interface UpdateUserInfoParams {
  enName?: string | null
  arName?: string | null
  phoneNumber?: string | null
  sex?: string | null
  dateOfBirth?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  educationLevel?: string | null
  school?: string | null
  fieldOfStudy?: string | null
  graduationYear?: number | null
  bloodType?: string | null
  socialMediaLinks?: string | null
  profilePictureUrl?: string | null
  biography?: string | null
  languages?: string | null
}

interface UserDisplayNameRow {
  membership_number: string
  en_name: string | null
  ar_name: string | null
}

export async function createUserInfo(db: D1DatabaseLike, params: CreateUserInfoParams): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_info (
        membership_number,
        en_name,
        ar_name,
        phone_number,
        sex,
        date_of_birth,
        country,
        region,
        city,
        address,
        education_level,
        school,
        field_of_study,
        graduation_year,
        blood_type,
        telegram_id,
        telegram_username,
        social_media_links,
        profile_picture_url,
        biography,
        languages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.membershipNumber,
      params.enName,
      params.arName,
      params.phoneNumber,
      params.sex,
      params.dateOfBirth,
      params.country,
      params.region,
      params.city,
      params.address,
      params.educationLevel,
      params.school,
      params.fieldOfStudy,
      params.graduationYear,
      params.bloodType,
      params.telegramId,
      params.telegramUsername,
      params.socialMediaLinks,
      params.profilePictureUrl,
      params.biography,
      params.languages,
    )
    .run()
}

export async function updateUserInfo(
  db: D1DatabaseLike,
  membershipNumber: string,
  params: UpdateUserInfoParams,
): Promise<void> {
  const updates: string[] = []
  const values: Array<string | number | null | undefined> = []

  if (params.enName !== undefined) {
    updates.push('en_name = ?')
    values.push(params.enName)
  }
  if (params.arName !== undefined) {
    updates.push('ar_name = ?')
    values.push(params.arName)
  }
  if (params.phoneNumber !== undefined) {
    updates.push('phone_number = ?')
    values.push(params.phoneNumber)
  }
  if (params.sex !== undefined) {
    updates.push('sex = ?')
    values.push(params.sex)
  }
  if (params.dateOfBirth !== undefined) {
    updates.push('date_of_birth = ?')
    values.push(params.dateOfBirth)
  }
  if (params.country !== undefined) {
    updates.push('country = ?')
    values.push(params.country)
  }
  if (params.region !== undefined) {
    updates.push('region = ?')
    values.push(params.region)
  }
  if (params.city !== undefined) {
    updates.push('city = ?')
    values.push(params.city)
  }
  if (params.address !== undefined) {
    updates.push('address = ?')
    values.push(params.address)
  }
  if (params.educationLevel !== undefined) {
    updates.push('education_level = ?')
    values.push(params.educationLevel)
  }
  if (params.school !== undefined) {
    updates.push('school = ?')
    values.push(params.school)
  }
  if (params.fieldOfStudy !== undefined) {
    updates.push('field_of_study = ?')
    values.push(params.fieldOfStudy)
  }
  if (params.graduationYear !== undefined) {
    updates.push('graduation_year = ?')
    values.push(params.graduationYear)
  }
  if (params.bloodType !== undefined) {
    updates.push('blood_type = ?')
    values.push(params.bloodType)
  }
  if (params.socialMediaLinks !== undefined) {
    updates.push('social_media_links = ?')
    values.push(params.socialMediaLinks)
  }
  if (params.profilePictureUrl !== undefined) {
    updates.push('profile_picture_url = ?')
    values.push(params.profilePictureUrl)
  }
  if (params.biography !== undefined) {
    updates.push('biography = ?')
    values.push(params.biography)
  }
  if (params.languages !== undefined) {
    updates.push('languages = ?')
    values.push(params.languages)
  }

  if (updates.length === 0) {
    return
  }

  values.push(membershipNumber)

  await db
    .prepare(`UPDATE user_info SET ${updates.join(', ')} WHERE membership_number = ?`)
    .bind(...values)
    .run()
}

export async function deleteUserInfoByMembershipNumber(db: D1DatabaseLike, membershipNumber: string): Promise<void> {
  await db.prepare('DELETE FROM user_info WHERE membership_number = ?').bind(membershipNumber).run()
}

export async function phoneNumberExists(db: D1DatabaseLike, phoneNumber: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM user_info WHERE phone_number = ? LIMIT 1')
    .bind(phoneNumber)
    .first()
  return !!result
}

export interface MemberContactInfoRow {
  membershipNumber: string
  email: string
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  telegramUsername: string | null
}

export async function getMemberContactInfoByMembershipNumber(
  db: D1DatabaseLike,
  membershipNumber: string,
): Promise<MemberContactInfoRow | null> {
  return db
    .prepare(
      `SELECT
        u.membership_number AS membershipNumber,
        u.email AS email,
        ui.en_name AS enName,
        ui.ar_name AS arName,
        ui.phone_number AS phoneNumber,
        ui.telegram_username AS telegramUsername
      FROM users u
      LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
      WHERE u.membership_number = ?
      LIMIT 1`,
    )
    .bind(membershipNumber)
    .first<MemberContactInfoRow>()
}

export async function getUserProfileByMembershipNumber(
  db: D1DatabaseLike,
  membershipNumber: string,
): Promise<UserProfileRow | null> {
  return db
    .prepare(
      `SELECT
        u.membership_number AS membershipNumber,
        u.email AS email,
        u.role AS role,
        ui.en_name AS enName,
        ui.ar_name AS arName,
        ui.phone_number AS phoneNumber,
        ui.sex AS sex,
        ui.date_of_birth AS dateOfBirth,
        ui.country AS country,
        ui.region AS region,
        ui.city AS city,
        ui.address AS address,
        ui.education_level AS educationLevel,
        ui.school AS school,
        ui.field_of_study AS fieldOfStudy,
        ui.graduation_year AS graduationYear,
        ui.blood_type AS bloodType,
        ui.telegram_id AS telegramId,
        ui.telegram_username AS telegramUsername,
        ui.social_media_links AS socialMediaLinks,
        ui.profile_picture_url AS profilePictureUrl,
        ui.biography AS biography,
        ui.languages AS languages
      FROM users u
      LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
      WHERE u.membership_number = ?
      LIMIT 1`
    )
    .bind(membershipNumber)
    .first<UserProfileRow>()
}

// D1 allows at most 100 bound parameters per statement.
const MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE = 80

export async function searchMembershipNumbers(db: D1DatabaseLike, query: string, limit = 100): Promise<string[]> {
  const needle = query.trim()
  if (!needle) {
    return []
  }

  const like = `%${needle.replace(/[%_]/g, '')}%`
  const rows = await db
    .prepare(
      `SELECT DISTINCT u.membership_number AS membershipNumber
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       WHERE u.membership_number LIKE ?
          OR u.email LIKE ?
          OR IFNULL(ui.en_name, '') LIKE ?
          OR IFNULL(ui.ar_name, '') LIKE ?
          OR IFNULL(ui.phone_number, '') LIKE ?
       LIMIT ?`,
    )
    .bind(like, like, like, like, like, Math.max(1, Math.min(limit, 200)))
    .all<{ membershipNumber: string }>()

  return rows.results.map((row) => row.membershipNumber).filter(Boolean)
}

export async function getMemberExportContactsByMembershipNumbers(
  db: D1DatabaseLike,
  membershipNumbers: string[],
): Promise<Map<string, { email: string; phoneNumber: string | null; displayName: string }>> {
  const uniqueMembershipNumbers = [...new Set(membershipNumbers.map((value) => value.trim()).filter(Boolean))]
  const contacts = new Map<string, { email: string; phoneNumber: string | null; displayName: string }>()

  if (uniqueMembershipNumbers.length === 0) {
    return contacts
  }

  for (let offset = 0; offset < uniqueMembershipNumbers.length; offset += MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE) {
    const batch = uniqueMembershipNumbers.slice(offset, offset + MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE)
    const placeholders = batch.map(() => '?').join(', ')
    const rows = await db
      .prepare(
        `SELECT
           u.membership_number AS membershipNumber,
           u.email AS email,
           ui.phone_number AS phoneNumber,
           ui.en_name AS enName,
           ui.ar_name AS arName
         FROM users u
         LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
         WHERE u.membership_number IN (${placeholders})`,
      )
      .bind(...batch)
      .all<{
        membershipNumber: string
        email: string
        phoneNumber: string | null
        enName: string | null
        arName: string | null
      }>()

    for (const row of rows.results ?? []) {
      contacts.set(row.membershipNumber, {
        email: row.email,
        phoneNumber: row.phoneNumber,
        displayName: row.arName?.trim() || row.enName?.trim() || row.membershipNumber,
      })
    }
  }

  return contacts
}

export async function getUserDisplayNamesByMembershipNumbers(
  db: D1DatabaseLike,
  membershipNumbers: string[],
): Promise<Map<string, string>> {
  const uniqueMembershipNumbers = [...new Set(membershipNumbers.map((value) => value.trim()).filter(Boolean))]

  if (uniqueMembershipNumbers.length === 0) {
    return new Map()
  }

  const displayNameMap = new Map<string, string>()

  for (let offset = 0; offset < uniqueMembershipNumbers.length; offset += MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE) {
    const batch = uniqueMembershipNumbers.slice(offset, offset + MEMBERSHIP_NUMBER_IN_CLAUSE_BATCH_SIZE)
    const placeholders = batch.map(() => '?').join(', ')
    const rows = await db
      .prepare(
        `SELECT membership_number, en_name, ar_name
         FROM user_info
         WHERE membership_number IN (${placeholders})`,
      )
      .bind(...batch)
      .all<UserDisplayNameRow>()

    for (const row of rows.results ?? []) {
      const displayName = row.ar_name?.trim() || row.en_name?.trim() || row.membership_number

      displayNameMap.set(row.membership_number, displayName)
    }
  }

  return displayNameMap
}

export async function memberHasTelegramId(db: D1DatabaseLike, membershipNumber: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT telegram_id
       FROM user_info
       WHERE membership_number = ?
         AND telegram_id IS NOT NULL
         AND trim(telegram_id) != ''
       LIMIT 1`,
    )
    .bind(membershipNumber.trim())
    .first<{ telegram_id: string }>()

  return Boolean(row?.telegram_id)
}
