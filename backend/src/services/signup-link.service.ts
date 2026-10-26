import { EmailAlreadyExistsError } from '../errors/registration.errors'
import { insertEmailVerificationToken, consumeEmailVerificationToken } from '../repositories/email-verification-tokens.repository'
import {
  consumeSignupIntent,
  getSignupIntent,
  insertSignupIntent,
  releaseSignupIntent,
  type SignupChannel,
  type SignupIntentRow,
} from '../repositories/signup-intents.repository'
import { getUserByEmail, getUserByMembershipNumber, setUserEmailVerified } from '../repositories/users.repository'
import { findMembershipNumberByTelegramId } from '../repositories/user-info.repository'
import type { AppBindings } from '../types/bindings'
import { createSignedToken, readSignedToken } from '../utils/signed-payload'

const SIGNUP_TTL_SECONDS = 60 * 60 * 24
const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24 * 7

export class SignupTokenError extends Error {
  constructor(message = 'رابط الانتساب غير صالح أو منتهٍ. اطلب رابطاً جديداً من صفحة الانتساب.') {
    super(message)
    this.name = 'SignupTokenError'
  }
}

export class TelegramAlreadyLinkedError extends Error {
  constructor() {
    super('حساب تيليغرام هذا مرتبط بعضوية موجودة.')
    this.name = 'TelegramAlreadyLinkedError'
  }
}

export class EmailVerificationTokenError extends Error {
  constructor(message = 'رابط تأكيد البريد غير صالح أو منتهٍ.') {
    super(message)
    this.name = 'EmailVerificationTokenError'
  }
}

interface SignupTokenPayload {
  purpose: 'signup'
  channel: SignupChannel
  jti: string
  email?: string
  telegramId?: string
  telegramUsername?: string | null
  exp: number
}

interface EmailVerificationTokenPayload {
  purpose: 'verify-email'
  jti: string
  membershipNumber: string
  email: string
  exp: number
}

export interface VerifiedSignupIntent {
  jti: string
  channel: SignupChannel
  email: string | null
  telegramId: string | null
  telegramUsername: string | null
}

function requireSecret(bindings: AppBindings): string {
  const secret = bindings.INTERNAL_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_SECRET is not configured.')
  }
  return secret
}

export function normalizeFrontendBaseUrl(baseUrl: string | undefined, fallbackOrigin: string): string {
  return (baseUrl?.trim() || fallbackOrigin).replace(/\/+$/, '')
}

export function sanitizeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('://')) {
    return null
  }

  return trimmed
}

export function buildRegistrationUrl(frontendBaseUrl: string, token: string, redirectPath?: string | null): string {
  const url = new URL(`${frontendBaseUrl}/registration`)
  url.searchParams.set('token', token)
  if (redirectPath) {
    url.searchParams.set('redirect', redirectPath)
  }
  return url.toString()
}

function expiresAtFromNow(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString()
}

function isExpired(expiresAt: string, exp: number): boolean {
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return true
  }

  const parsed = Date.parse(expiresAt)
  return Number.isNaN(parsed) || parsed <= Date.now()
}

export async function createEmailSignupLink(
  bindings: AppBindings,
  email: string,
  redirectPath?: string | null,
): Promise<{ token: string; url: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await getUserByEmail(bindings.MEMBERS_DB, normalizedEmail)
  if (existing) {
    throw new EmailAlreadyExistsError()
  }

  const jti = crypto.randomUUID()
  const exp = Math.floor(Date.now() / 1000) + SIGNUP_TTL_SECONDS
  const payload: SignupTokenPayload = {
    purpose: 'signup',
    channel: 'email',
    jti,
    email: normalizedEmail,
    exp,
  }

  await insertSignupIntent(bindings.MEMBERS_DB, {
    jti,
    channel: 'email',
    email: normalizedEmail,
    telegramId: null,
    telegramUsername: null,
    expiresAt: expiresAtFromNow(SIGNUP_TTL_SECONDS),
  })

  const token = await createSignedToken(requireSecret(bindings), payload)
  const url = buildRegistrationUrl(
    normalizeFrontendBaseUrl(bindings.FRONTEND_BASE_URL, 'https://ibtikar.tr'),
    token,
    redirectPath,
  )
  return { token, url }
}

export async function createTelegramSignupLink(
  bindings: AppBindings,
  telegramId: string,
  telegramUsername: string | null,
): Promise<{ token: string; url: string }> {
  const normalizedTelegramId = telegramId.trim()
  if (!normalizedTelegramId) {
    throw new SignupTokenError('معرّف تيليغرام مطلوب.')
  }

  const linkedMembership = await findMembershipNumberByTelegramId(bindings.MEMBERS_DB, normalizedTelegramId)
  if (linkedMembership) {
    throw new TelegramAlreadyLinkedError()
  }

  const jti = crypto.randomUUID()
  const exp = Math.floor(Date.now() / 1000) + SIGNUP_TTL_SECONDS
  const username = telegramUsername?.trim() || null
  const payload: SignupTokenPayload = {
    purpose: 'signup',
    channel: 'telegram',
    jti,
    telegramId: normalizedTelegramId,
    telegramUsername: username,
    exp,
  }

  await insertSignupIntent(bindings.MEMBERS_DB, {
    jti,
    channel: 'telegram',
    email: null,
    telegramId: normalizedTelegramId,
    telegramUsername: username,
    expiresAt: expiresAtFromNow(SIGNUP_TTL_SECONDS),
  })

  const token = await createSignedToken(requireSecret(bindings), payload)
  const url = buildRegistrationUrl(
    normalizeFrontendBaseUrl(bindings.FRONTEND_BASE_URL, 'https://ibtikar.tr'),
    token,
    null,
  )
  return { token, url }
}

function intentFromRow(row: SignupIntentRow, payload: SignupTokenPayload): VerifiedSignupIntent | null {
  if (row.consumed_at || isExpired(row.expires_at, payload.exp) || row.channel !== payload.channel) {
    return null
  }

  if (payload.channel === 'email') {
    const email = payload.email?.trim().toLowerCase()
    if (!email || row.email?.trim().toLowerCase() !== email) {
      return null
    }

    return {
      jti: row.jti,
      channel: 'email',
      email,
      telegramId: null,
      telegramUsername: null,
    }
  }

  const telegramId = payload.telegramId?.trim()
  if (!telegramId || row.telegram_id !== telegramId) {
    return null
  }

  return {
    jti: row.jti,
    channel: 'telegram',
    email: null,
    telegramId,
    telegramUsername: payload.telegramUsername?.trim() || row.telegram_username,
  }
}

export async function verifySignupToken(bindings: AppBindings, token: string): Promise<VerifiedSignupIntent> {
  const payload = await readSignedToken<SignupTokenPayload>(requireSecret(bindings), token.trim())
  if (!payload || payload.purpose !== 'signup' || (payload.channel !== 'email' && payload.channel !== 'telegram')) {
    throw new SignupTokenError()
  }

  if (typeof payload.jti !== 'string' || typeof payload.exp !== 'number') {
    throw new SignupTokenError()
  }

  const row = await getSignupIntent(bindings.MEMBERS_DB, payload.jti)
  const intent = row ? intentFromRow(row, payload) : null
  if (!intent) {
    throw new SignupTokenError()
  }

  return intent
}

export async function claimSignupIntent(bindings: AppBindings, jti: string): Promise<void> {
  const claimed = await consumeSignupIntent(bindings.MEMBERS_DB, jti)
  if (!claimed) {
    throw new SignupTokenError()
  }
}

export async function releaseClaimedSignupIntent(bindings: AppBindings, jti: string): Promise<void> {
  await releaseSignupIntent(bindings.MEMBERS_DB, jti)
}

export async function createEmailVerificationLink(
  bindings: AppBindings,
  membershipNumber: string,
  email: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase()
  const jti = crypto.randomUUID()
  const exp = Math.floor(Date.now() / 1000) + EMAIL_VERIFICATION_TTL_SECONDS
  const payload: EmailVerificationTokenPayload = {
    purpose: 'verify-email',
    jti,
    membershipNumber,
    email: normalizedEmail,
    exp,
  }

  await insertEmailVerificationToken(bindings.MEMBERS_DB, {
    jti,
    membershipNumber,
    email: normalizedEmail,
    expiresAt: expiresAtFromNow(EMAIL_VERIFICATION_TTL_SECONDS),
  })

  const token = await createSignedToken(requireSecret(bindings), payload)
  const url = new URL(
    `${normalizeFrontendBaseUrl(bindings.FRONTEND_BASE_URL, 'https://ibtikar.tr')}/verify-email`,
  )
  url.searchParams.set('token', token)
  return url.toString()
}

export async function confirmEmailVerification(
  bindings: AppBindings,
  token: string,
): Promise<{ alreadyVerified: boolean; membershipNumber: string }> {
  const payload = await readSignedToken<EmailVerificationTokenPayload>(requireSecret(bindings), token.trim())
  if (
    !payload
    || payload.purpose !== 'verify-email'
    || typeof payload.jti !== 'string'
    || typeof payload.membershipNumber !== 'string'
    || typeof payload.email !== 'string'
    || typeof payload.exp !== 'number'
    || payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new EmailVerificationTokenError()
  }

  const user = await getUserByMembershipNumber(bindings.MEMBERS_DB, payload.membershipNumber)
  if (!user || user.email.trim().toLowerCase() !== payload.email.trim().toLowerCase()) {
    throw new EmailVerificationTokenError()
  }

  if (user.email_verified === 1) {
    return { alreadyVerified: true, membershipNumber: user.membership_number }
  }

  const consumed = await consumeEmailVerificationToken(bindings.MEMBERS_DB, payload.jti)
  if (!consumed) {
    throw new EmailVerificationTokenError()
  }

  await setUserEmailVerified(bindings.MEMBERS_DB, user.membership_number, true)
  return { alreadyVerified: false, membershipNumber: user.membership_number }
}
