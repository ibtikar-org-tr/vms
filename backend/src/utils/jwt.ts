import type { AppBindings } from '../types/bindings'
import type { AccessTokenPayload, AuthUser } from '../types/auth'
import { base64UrlToBytes, bytesToBase64Url } from './crypto'

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24
export const VMS_JWT_ISSUER = 'ibtikar-vms'
export const VMS_JWT_KID = 'vms-access-1'

type JsonWebKeyWithKid = JsonWebKey & { kid?: string; use?: string; alg?: string }

type CachedSigningKey = {
  privateKey: CryptoKey
  publicJwk: JsonWebKeyWithKid
}

let cachedSigningKey: CachedSigningKey | null = null

function pemToBinary(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function getPrivateKeyPem(bindings: AppBindings): string {
  const pem = bindings.JWT_PRIVATE_KEY?.trim()
  if (!pem) {
    throw new Error('JWT_PRIVATE_KEY is not configured.')
  }
  return pem.replace(/\\n/g, '\n')
}

async function getSigningKey(bindings: AppBindings): Promise<CachedSigningKey> {
  if (cachedSigningKey) return cachedSigningKey

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(getPrivateKeyPem(bindings)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign'],
  )

  const privateJwk = (await crypto.subtle.exportKey('jwk', privateKey)) as JsonWebKey
  const publicJwk: JsonWebKeyWithKid = {
    kty: privateJwk.kty,
    n: privateJwk.n,
    e: privateJwk.e,
    alg: 'RS256',
    use: 'sig',
    kid: VMS_JWT_KID,
  }

  cachedSigningKey = { privateKey, publicJwk }
  return cachedSigningKey
}

async function getVerifierKey(bindings: AppBindings): Promise<CryptoKey> {
  const { publicJwk } = await getSigningKey(bindings)
  return crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

export async function getJwks(bindings: AppBindings): Promise<{ keys: JsonWebKeyWithKid[] }> {
  const { publicJwk } = await getSigningKey(bindings)
  return { keys: [publicJwk] }
}

export async function createAccessToken(bindings: AppBindings, user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: VMS_JWT_KID,
  }
  const payload: AccessTokenPayload = {
    iss: VMS_JWT_ISSUER,
    sub: user.membershipNumber,
    email: user.email,
    role: user.role,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  }

  const headerEncoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadEncoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${headerEncoded}.${payloadEncoded}`

  const { privateKey } = await getSigningKey(bindings)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifyAccessToken(
  bindings: AppBindings,
  token: string,
): Promise<AccessTokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts
  if (!headerPart || !payloadPart || !signaturePart) return null

  let header: { alg?: string; kid?: string }
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart))) as {
      alg?: string
      kid?: string
    }
  } catch {
    return null
  }

  if (header.alg !== 'RS256') return null
  if (header.kid && header.kid !== VMS_JWT_KID) return null

  const publicKey = await getVerifierKey(bindings)
  const signatureBytes = base64UrlToBytes(signaturePart)
  const signature = new Uint8Array(signatureBytes)
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  )
  if (!ok) return null

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)))
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object') return null

  const iss = 'iss' in payload ? payload.iss : undefined
  const sub = 'sub' in payload ? payload.sub : undefined
  const email = 'email' in payload ? payload.email : undefined
  const role = 'role' in payload ? payload.role : undefined
  const type = 'type' in payload ? payload.type : undefined
  const exp = 'exp' in payload ? payload.exp : undefined

  if (
    iss !== VMS_JWT_ISSUER ||
    typeof sub !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    type !== 'access' ||
    typeof exp !== 'number' ||
    !Number.isFinite(exp)
  ) {
    return null
  }

  if (exp <= Math.floor(Date.now() / 1000)) return null

  return {
    iss: VMS_JWT_ISSUER,
    sub,
    email,
    role,
    type: 'access',
    exp,
    iat: 'iat' in payload && typeof payload.iat === 'number' ? payload.iat : 0,
  }
}

export function accessTokenToAuthUser(payload: AccessTokenPayload): AuthUser {
  return {
    membershipNumber: payload.sub,
    email: payload.email,
    role: payload.role,
  }
}
