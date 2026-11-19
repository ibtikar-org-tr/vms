import type { D1DatabaseLike } from '../types/bindings'

export interface EventRegistrantIdentity {
  membershipNumber: string | null
  guestEmail: string | null
  guestName: string | null
  guestPhone: string | null
}

export interface EventAnnouncementPerson {
  key: string
  membershipNumber: string | null
  email: string | null
  displayName: string
  phoneNumber: string | null
  telegramUsername: string | null
  hasTelegram: boolean
}

interface MemberContactRow {
  membershipNumber: string
  email: string | null
  arName: string | null
  enName: string | null
  phoneNumber: string | null
  telegramUsername: string | null
  telegramId: string | null
}

const MEMBERSHIP_IN_BATCH = 80

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return trimmed || null
}

function registrantKey(row: EventRegistrantIdentity) {
  if (row.membershipNumber?.trim()) {
    return `m:${row.membershipNumber.trim()}`
  }
  const email = normalizeEmail(row.guestEmail)
  return email ? `g:${email}` : null
}

export async function listActiveEventRegistrantIdentities(db: D1DatabaseLike, eventId: string) {
  const result = await db
    .prepare(
      `SELECT
         membership_number AS membershipNumber,
         guest_email AS guestEmail,
         guest_name AS guestName,
         guest_phone AS guestPhone
       FROM event_registrations
       WHERE event_id = ?
         AND status IN ('registered', 'attended')`,
    )
    .bind(eventId)
    .all<EventRegistrantIdentity>()

  const unique = new Map<string, EventRegistrantIdentity>()
  for (const row of result.results) {
    const key = registrantKey(row)
    if (!key || unique.has(key)) {
      continue
    }
    unique.set(key, {
      membershipNumber: row.membershipNumber?.trim() || null,
      guestEmail: normalizeEmail(row.guestEmail),
      guestName: row.guestName?.trim() || null,
      guestPhone: row.guestPhone?.trim() || null,
    })
  }

  return [...unique.entries()].map(([key, row]) => ({ key, ...row }))
}

async function listMemberContacts(db: D1DatabaseLike, membershipNumbers: string[]) {
  const uniqueNumbers = [...new Set(membershipNumbers.map((value) => value.trim()).filter(Boolean))]
  const contacts = new Map<string, MemberContactRow>()
  if (uniqueNumbers.length === 0) {
    return contacts
  }

  for (let offset = 0; offset < uniqueNumbers.length; offset += MEMBERSHIP_IN_BATCH) {
    const batch = uniqueNumbers.slice(offset, offset + MEMBERSHIP_IN_BATCH)
    const placeholders = batch.map(() => '?').join(', ')
    const result = await db
      .prepare(
        `SELECT
           u.membership_number AS membershipNumber,
           u.email AS email,
           ui.ar_name AS arName,
           ui.en_name AS enName,
           ui.phone_number AS phoneNumber,
           ui.telegram_username AS telegramUsername,
           ui.telegram_id AS telegramId
         FROM users u
         LEFT JOIN user_info ui ON ui.membership_number = u.membership_number
         WHERE u.membership_number IN (${placeholders})`,
      )
      .bind(...batch)
      .all<MemberContactRow>()

    for (const row of result.results) {
      contacts.set(row.membershipNumber, row)
    }
  }

  return contacts
}

export async function listEventAnnouncementPeople(
  vmsDb: D1DatabaseLike,
  membersDb: D1DatabaseLike,
  eventId: string,
): Promise<EventAnnouncementPerson[]> {
  const identities = await listActiveEventRegistrantIdentities(vmsDb, eventId)
  const contacts = await listMemberContacts(
    membersDb,
    identities.map((item) => item.membershipNumber ?? ''),
  )

  return identities
    .map((item) => {
      const contact = item.membershipNumber ? contacts.get(item.membershipNumber) : undefined
      const email = normalizeEmail(contact?.email) || item.guestEmail
      const displayName =
        contact?.arName?.trim() ||
        contact?.enName?.trim() ||
        item.guestName ||
        item.membershipNumber ||
        email ||
        'مسجّل'
      return {
        key: item.key,
        membershipNumber: item.membershipNumber,
        email,
        displayName,
        phoneNumber: contact?.phoneNumber?.trim() || item.guestPhone || null,
        telegramUsername: contact?.telegramUsername?.replace(/^@/, '').trim() || null,
        hasTelegram: Boolean(contact?.telegramId?.trim()),
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))
}

export function eventAnnouncementEmailRecipients(people: EventAnnouncementPerson[]) {
  return people.filter((person) => Boolean(person.email))
}

export function eventAnnouncementTelegramRecipients(people: EventAnnouncementPerson[]) {
  return people.filter((person) => Boolean(person.membershipNumber && person.hasTelegram))
}

export function eventAnnouncementAudience(people: EventAnnouncementPerson[]) {
  const email = eventAnnouncementEmailRecipients(people)
  const telegram = eventAnnouncementTelegramRecipients(people)
  return {
    people: people.length,
    email: email.length,
    telegram: telegram.length,
  }
}
