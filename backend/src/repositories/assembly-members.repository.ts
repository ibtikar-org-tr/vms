import type { D1DatabaseLike } from '../types/bindings'

export interface AssemblyMemberRow {
  membershipNumber: string
  email: string
  role: string
  createdAt: string
  pointBalance: number
  emailVerified: boolean
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  country: string | null
  region: string | null
  city: string | null
  school: string | null
  fieldOfStudy: string | null
  telegramId: string | null
  telegramUsername: string | null
  interestInVolunteering: string | null
}

export interface AssemblyEmailRecipient {
  membershipNumber: string
  email: string
  displayName: string
}

interface AssemblyMemberSqlRow {
  membershipNumber: string
  email: string
  role: string
  createdAt: string
  pointBalance: number
  emailVerified: number | null
  enName: string | null
  arName: string | null
  phoneNumber: string | null
  sex: string | null
  country: string | null
  region: string | null
  city: string | null
  school: string | null
  fieldOfStudy: string | null
  telegramId: string | null
  telegramUsername: string | null
  interestInVolunteering: string | null
}

function mapMemberRow(row: AssemblyMemberSqlRow): AssemblyMemberRow {
  return {
    ...row,
    emailVerified: row.emailVerified === 1,
  }
}

const MEMBER_SELECT = `
  SELECT
    u.membership_number AS membershipNumber,
    u.email AS email,
    u.role AS role,
    u.created_at AS createdAt,
    u.point_balance AS pointBalance,
    u.email_verified AS emailVerified,
    ui.en_name AS enName,
    ui.ar_name AS arName,
    ui.phone_number AS phoneNumber,
    ui.sex AS sex,
    ui.country AS country,
    ui.region AS region,
    ui.city AS city,
    ui.school AS school,
    ui.field_of_study AS fieldOfStudy,
    ui.telegram_id AS telegramId,
    ui.telegram_username AS telegramUsername,
    uri.interest_in_volunteering AS interestInVolunteering
  FROM users u
  LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
  LEFT JOIN user_registration_info uri ON uri.membership_number = u.membership_number
`

function volunteerClause(volunteersOnly: boolean) {
  return volunteersOnly
    ? "AND LOWER(IFNULL(uri.interest_in_volunteering, '')) IN ('yes', 'maybe')"
    : ''
}

export async function listAssemblyMembers(
  db: D1DatabaseLike,
  options: { query?: string; volunteersOnly?: boolean; limit: number; offset: number },
) {
  const needle = options.query?.trim() ?? ''
  const like = `%${needle.replace(/[%_]/g, '')}%`
  const volunteersOnly = options.volunteersOnly === true
  const limit = Math.max(1, Math.min(options.limit, 100))
  const offset = Math.max(0, options.offset)
  const searchClause = needle
    ? `AND (
         u.membership_number LIKE ?
         OR u.email LIKE ?
         OR IFNULL(ui.ar_name, '') LIKE ?
         OR IFNULL(ui.en_name, '') LIKE ?
         OR IFNULL(ui.phone_number, '') LIKE ?
       )`
    : ''

  const where = `WHERE 1 = 1 ${searchClause} ${volunteerClause(volunteersOnly)}`
  const binds = needle ? [like, like, like, like, like, limit, offset] : [limit, offset]

  const result = await db
    .prepare(
      `${MEMBER_SELECT}
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds)
    .all<AssemblyMemberSqlRow>()

  const countBinds = needle ? [like, like, like, like, like] : []
  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       LEFT JOIN user_registration_info uri ON uri.membership_number = u.membership_number
       ${where}`,
    )
    .bind(...countBinds)
    .first<{ total: number }>()

  return {
    members: result.results.map(mapMemberRow),
    total: Number(countRow?.total ?? 0),
  }
}

export async function listAssemblyMembersForExport(
  db: D1DatabaseLike,
  options: { query?: string; volunteersOnly?: boolean },
) {
  const needle = options.query?.trim() ?? ''
  const like = `%${needle.replace(/[%_]/g, '')}%`
  const volunteersOnly = options.volunteersOnly === true
  const searchClause = needle
    ? `AND (
         u.membership_number LIKE ?
         OR u.email LIKE ?
         OR IFNULL(ui.ar_name, '') LIKE ?
         OR IFNULL(ui.en_name, '') LIKE ?
         OR IFNULL(ui.phone_number, '') LIKE ?
       )`
    : ''
  const where = `WHERE 1 = 1 ${searchClause} ${volunteerClause(volunteersOnly)}`
  const binds = needle ? [like, like, like, like, like] : []

  const result = await db
    .prepare(
      `${MEMBER_SELECT}
       ${where}
       ORDER BY u.created_at DESC
       LIMIT 5000`,
    )
    .bind(...binds)
    .all<AssemblyMemberSqlRow>()

  return result.results.map(mapMemberRow)
}

function mapEmailRecipient(row: {
  membershipNumber: string
  email: string
  arName: string | null
  enName: string | null
}): AssemblyEmailRecipient {
  return {
    membershipNumber: row.membershipNumber,
    email: row.email.trim().toLowerCase(),
    displayName: row.arName?.trim() || row.enName?.trim() || 'عضو تجمّع إبتكار',
  }
}

export async function countAssemblyEmailRecipients(db: D1DatabaseLike) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM users
       WHERE email IS NOT NULL AND trim(email) <> ''`,
    )
    .bind()
    .first<{ total: number }>()

  return Number(row?.total ?? 0)
}

export async function listAssemblyEmailRecipientsPage(db: D1DatabaseLike, offset: number, limit: number) {
  const result = await db
    .prepare(
      `SELECT
         u.membership_number AS membershipNumber,
         u.email AS email,
         ui.ar_name AS arName,
         ui.en_name AS enName
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       WHERE u.email IS NOT NULL AND trim(u.email) <> ''
       ORDER BY u.membership_number
       LIMIT ? OFFSET ?`,
    )
    .bind(Math.max(1, Math.min(limit, 20)), Math.max(0, offset))
    .all<{ membershipNumber: string; email: string; arName: string | null; enName: string | null }>()

  return result.results.map(mapEmailRecipient)
}

export async function listAssemblyEmailRecipients(db: D1DatabaseLike) {
  const result = await db
    .prepare(
      `SELECT
         u.membership_number AS membershipNumber,
         u.email AS email,
         ui.ar_name AS arName,
         ui.en_name AS enName
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       WHERE u.email IS NOT NULL AND trim(u.email) <> ''
       ORDER BY u.membership_number`,
    )
    .bind()
    .all<{ membershipNumber: string; email: string; arName: string | null; enName: string | null }>()

  return result.results.map(mapEmailRecipient)
}

export async function countAssemblyTelegramRecipients(db: D1DatabaseLike) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM user_info
       WHERE telegram_id IS NOT NULL AND trim(telegram_id) <> ''`,
    )
    .bind()
    .first<{ total: number }>()

  return Number(row?.total ?? 0)
}

export async function listAssemblyMemberContacts(db: D1DatabaseLike, membershipNumbers: string[]) {
  const uniqueNumbers = [...new Set(membershipNumbers.map((value) => value.trim()).filter(Boolean))]
  if (uniqueNumbers.length === 0) {
    return [] as AssemblyEmailRecipient[]
  }

  const placeholders = uniqueNumbers.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `SELECT
         u.membership_number AS membershipNumber,
         u.email AS email,
         ui.ar_name AS arName,
         ui.en_name AS enName
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       WHERE u.membership_number IN (${placeholders})`,
    )
    .bind(...uniqueNumbers)
    .all<{ membershipNumber: string; email: string | null; arName: string | null; enName: string | null }>()

  return result.results.map((row) => ({
    membershipNumber: row.membershipNumber,
    email: row.email?.trim().toLowerCase() || '',
    displayName: row.arName?.trim() || row.enName?.trim() || row.membershipNumber,
  }))
}

export async function listAssemblyTelegramMembershipNumbersPage(db: D1DatabaseLike, offset: number, limit: number) {
  const result = await db
    .prepare(
      `SELECT membership_number AS membershipNumber
       FROM user_info
       WHERE telegram_id IS NOT NULL AND trim(telegram_id) <> ''
       ORDER BY membership_number
       LIMIT ? OFFSET ?`,
    )
    .bind(Math.max(1, Math.min(limit, 30)), Math.max(0, offset))
    .all<{ membershipNumber: string }>()

  return result.results.map((row) => row.membershipNumber)
}

export async function countAssemblyDirectory(db: D1DatabaseLike) {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS totalMembers,
         SUM(CASE WHEN ui.telegram_id IS NOT NULL AND trim(ui.telegram_id) <> '' THEN 1 ELSE 0 END) AS telegramLinked,
         SUM(CASE WHEN LOWER(IFNULL(uri.interest_in_volunteering, '')) IN ('yes', 'maybe') THEN 1 ELSE 0 END) AS volunteers
       FROM users u
       LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
       LEFT JOIN user_registration_info uri ON uri.membership_number = u.membership_number`,
    )
    .bind()
    .first<{ totalMembers: number; telegramLinked: number | null; volunteers: number | null }>()

  return {
    totalMembers: Number(row?.totalMembers ?? 0),
    telegramLinked: Number(row?.telegramLinked ?? 0),
    volunteers: Number(row?.volunteers ?? 0),
  }
}
