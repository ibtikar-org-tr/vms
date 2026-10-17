import {
  EmailAlreadyExistsError,
  MembershipNumberAllocationError,
  PhoneNumberAlreadyExistsError,
} from '../errors/registration.errors'
import {
  createUserInfo,
  deleteUserInfoByMembershipNumber,
  findMembershipNumberByTelegramId,
  phoneNumberExists,
} from '../repositories/user-info.repository'
import {
  createUserRegistrationInfo,
  deleteUserRegistrationInfoByMembershipNumber,
} from '../repositories/user-registration-info.repository'
import {
  createUser,
  deleteUserByMembershipNumber,
  getLatestMembershipNumber,
  getUserByEmail,
} from '../repositories/users.repository'
import {
  deleteAllUserSkillsByMembershipNumber,
  upsertUserSkill,
} from '../repositories/user-skills.repository'
import { claimGuestEventRegistrations } from '../repositories/vms-event-registrations.repository'
import { createSkill, getSkillByName } from '../repositories/vms-skills.repository'
import type { RegistrationInput } from '../schemas/registration'
import { sendRegistrationCredentialsEmail } from './registration-email.service'
import { sendDuplicateSignupAlertEmail, sendEmailVerificationEmail } from './signup-email.service'
import {
  claimSignupIntent,
  createEmailVerificationLink,
  releaseClaimedSignupIntent,
  type VerifiedSignupIntent,
} from './signup-link.service'
import { sendTelegramDirectMessage } from './telegram-notification.service'
import type { AppBindings } from '../types/bindings'
import { generateNextMembershipNumber } from '../utils/membership-number'
import { generateTemporaryPassword, hashPassword } from '../utils/password'
import { generateId } from '../utils/id'

export class TelegramIdAlreadyUsedError extends Error {
  constructor() {
    super('حساب تيليغرام هذا مرتبط بعضوية موجودة.')
    this.name = 'TelegramIdAlreadyUsedError'
  }
}

export interface RegistrationResult {
  membershipNumber: string
  temporaryPassword: string
  channel: VerifiedSignupIntent['channel']
}

function toJsonOrNull(value?: Record<string, string>): string | null {
  if (!value) {
    return null
  }

  return JSON.stringify(value)
}

function uniqueTrimmedValues(values: string[]) {
  const seen = new Set<string>()
  const uniqueValues: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }

    const dedupeKey = trimmed.toLocaleLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    uniqueValues.push(trimmed)
  }

  return uniqueValues
}

const MEMBERSHIP_NUMBER_ALLOCATION_ATTEMPTS = 5

function isMembershipNumberConflict(error: unknown) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed: users.membership_number')
}

function isEmailConflict(error: unknown) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')
}

async function createUserWithMembershipRetry(
  membersDb: AppBindings['MEMBERS_DB'],
  prefix: string,
    params: {
    email: string
    passwordHash: string
    role: string
    emailVerified: boolean
  },
) {
  for (let attempt = 0; attempt < MEMBERSHIP_NUMBER_ALLOCATION_ATTEMPTS; attempt += 1) {
    const lastMembershipNumber = await getLatestMembershipNumber(membersDb, prefix)
    const membershipNumber = generateNextMembershipNumber(lastMembershipNumber, prefix)

    try {
      await createUser(membersDb, {
        membershipNumber,
        email: params.email,
        passwordHash: params.passwordHash,
        role: params.role,
        emailVerified: params.emailVerified,
      })
      return membershipNumber
    } catch (error) {
      if (isEmailConflict(error)) {
        throw new EmailAlreadyExistsError()
      }

      if (isMembershipNumberConflict(error) && attempt < MEMBERSHIP_NUMBER_ALLOCATION_ATTEMPTS - 1) {
        continue
      }

      if (isMembershipNumberConflict(error)) {
        throw new MembershipNumberAllocationError()
      }

      throw error
    }
  }

  throw new MembershipNumberAllocationError()
}

async function getOrCreateSkill(vmsDb: AppBindings['VMS_DB'], skillName: string): Promise<string> {
  const existing = await getSkillByName(vmsDb, skillName)
  if (existing) {
    return existing.id
  }

  const skillId = generateId()
  await createSkill(vmsDb, {
    id: skillId,
    name: skillName,
  })

  return skillId
}

async function saveRegistrationSkills(
  membersDb: AppBindings['MEMBERS_DB'],
  vmsDb: AppBindings['VMS_DB'],
  membershipNumber: string,
  interests: string[],
  skills?: string[],
) {
  for (const interest of uniqueTrimmedValues(interests)) {
    const skillId = await getOrCreateSkill(vmsDb, interest)
    await upsertUserSkill(membersDb, membershipNumber, skillId, 'interest')
  }

  if (!skills || skills.length === 0) {
    return
  }

  for (const skillName of uniqueTrimmedValues(skills)) {
    const skillId = await getOrCreateSkill(vmsDb, skillName)
    await upsertUserSkill(membersDb, membershipNumber, skillId, 'skill', 'beginner')
  }
}

async function notifyTelegramEmailConflict(bindings: AppBindings, telegramId: string, email: string): Promise<void> {
  const telegramResult = await sendTelegramDirectMessage(
    bindings,
    telegramId,
    'تعذّر إنشاء العضوية لأن هذا البريد الإلكتروني مسجّل مسبقاً لعضو آخر. إذا كان الحساب لك، استخدم صفحة استرجاع العضوية.',
  )
  if (!telegramResult.success) {
    console.error('Failed to notify Telegram applicant about an existing email', telegramResult.error)
  }

  try {
    await sendDuplicateSignupAlertEmail(bindings, email)
  } catch (error) {
    console.error('Failed to send duplicate-signup alert email', error)
  }
}

export async function registerUser(
  bindings: AppBindings,
  input: RegistrationInput,
  intent: VerifiedSignupIntent,
): Promise<RegistrationResult> {
  const membersDb = bindings.MEMBERS_DB
  const vmsDb = bindings.VMS_DB
  const membershipPrefix = bindings.MEMBERSHIP_NUMBER_PREFIX
  const email = intent.channel === 'email' ? (intent.email ?? input.email) : input.email
  const emailVerified = intent.channel === 'email'
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  if (intent.channel === 'telegram') {
    const existingUser = await getUserByEmail(membersDb, email)
    if (existingUser) {
      if (intent.telegramId) {
        await notifyTelegramEmailConflict(bindings, intent.telegramId, email)
      }
      throw new EmailAlreadyExistsError()
    }

    if (intent.telegramId) {
      const linkedMembership = await findMembershipNumberByTelegramId(membersDb, intent.telegramId)
      if (linkedMembership) {
        throw new TelegramIdAlreadyUsedError()
      }
    }
  }

  if (input.phoneNumber) {
    const phoneExists = await phoneNumberExists(membersDb, input.phoneNumber)
    if (phoneExists) {
      throw new PhoneNumberAlreadyExistsError()
    }
  }

  await claimSignupIntent(bindings, intent.jti)

  let membershipNumber: string | null = null
  try {
    membershipNumber = await createUserWithMembershipRetry(membersDb, membershipPrefix, {
      email,
      passwordHash,
      role: 'member',
      emailVerified,
    })

    await createUserInfo(membersDb, {
      membershipNumber,
      enName: input.enName,
      arName: input.arName,
      phoneNumber: input.phoneNumber ?? null,
      sex: input.sex ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      country: input.country ?? null,
      region: input.region ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      educationLevel: input.educationLevel ?? null,
      school: input.school ?? null,
      fieldOfStudy: input.fieldOfStudy ?? null,
      graduationYear: input.graduationYear ?? null,
      bloodType: input.bloodType ?? null,
      telegramId: intent.channel === 'telegram' ? intent.telegramId : null,
      telegramUsername: intent.channel === 'telegram' ? intent.telegramUsername : null,
      socialMediaLinks: toJsonOrNull(input.socialMediaLinks),
      profilePictureUrl: null,
      biography: input.biography ?? null,
      languages: input.languages ? input.languages.join(', ') : null,
    })

    await saveRegistrationSkills(membersDb, vmsDb, membershipNumber, input.interests, input.skills)

    await createUserRegistrationInfo(membersDb, {
      membershipNumber,
      whereHeardAboutUs: input.whereHeardAboutUs ?? null,
      motivationLetter: input.motivationLetter ?? null,
      friendsOnPlatform: input.friendsOnPlatform ? input.friendsOnPlatform.join(', ') : null,
      interestInVolunteering: input.interestInVolunteering ?? null,
      previousExperience: input.previousExperience ?? null,
    })

    try {
      await claimGuestEventRegistrations(vmsDb, membershipNumber, email)
    } catch (error) {
      console.error('Failed to claim guest event registrations', error)
    }

    if (intent.channel === 'email') {
      await sendRegistrationCredentialsEmail(bindings, {
        recipientEmail: email,
        membershipNumber,
        temporaryPassword,
      })
    }
  } catch (error) {
    await Promise.allSettled([
      ...(membershipNumber
        ? [
          deleteAllUserSkillsByMembershipNumber(membersDb, membershipNumber),
          deleteUserRegistrationInfoByMembershipNumber(membersDb, membershipNumber),
          deleteUserInfoByMembershipNumber(membersDb, membershipNumber),
          deleteUserByMembershipNumber(membersDb, membershipNumber),
        ]
        : []),
      releaseClaimedSignupIntent(bindings, intent.jti),
    ])
    throw error
  }

  if (!membershipNumber) {
    throw new MembershipNumberAllocationError()
  }

  if (intent.channel === 'telegram' && intent.telegramId) {
    try {
      const verificationUrl = await createEmailVerificationLink(bindings, membershipNumber, email)
      await sendEmailVerificationEmail(bindings, email, verificationUrl)
    } catch (error) {
      console.error('Failed to send email verification link after Telegram signup', error)
    }

    const telegramResult = await sendTelegramDirectMessage(
      bindings,
      intent.telegramId,
      `تم إنشاء عضويتك في تجمّع إبتكار.\n`
      + `رقم العضوية: ${membershipNumber}\n`
      + `كلمة المرور المؤقتة: ${temporaryPassword}\n\n`
      + 'بريدك لم يُؤكَّد بعد. افتح الرسالة التي أرسلناها إلى بريدك واضغط رابط التأكيد. يمكنك استخدام العضوية الآن.',
    )
    if (!telegramResult.success) {
      console.error('Failed to send Telegram signup credentials', telegramResult.error)
    }
  }

  return {
    membershipNumber,
    temporaryPassword,
    channel: intent.channel,
  }
}
