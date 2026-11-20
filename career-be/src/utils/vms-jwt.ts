import type { Environment } from '../types/env'
import { fetchVmsApi } from './vms-fetch'

export interface VmsAccessTokenPayload {
  iss: string
  sub: string
  email: string
  role: string
  type: 'access'
  exp: number
  iat: number
}

const VMS_JWT_ISSUER = 'ibtikar-vms'

type Jwk = JsonWebKey & { kid?: string; alg?: string; kty?: string }

type JwksCache = {
  fetchedAt: number
  keys: Map<string, CryptoKey>
}

const JWKS_TTL_MS = 5 * 60 * 1000
let jwksCache: JwksCache | null = null

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(normalized + padding)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function loadJwks(env: Environment): Promise<Map<string, CryptoKey>> {
  const now = Date.now()
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys
  }

  const response = await fetchVmsApi(env, '/.well-known/jwks.json', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`JWKS fetch failed (${response.status})`)
  }

  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) continue
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    keys.set(jwk.kid || 'default', cryptoKey)
  }

  if (keys.size === 0) {
    throw new Error('JWKS contained no usable RSA keys')
  }

  jwksCache = { fetchedAt: now, keys }
  return keys
}

export async function verifyVmsAccessToken(
  env: Environment,
  token: string,
): Promise<VmsAccessTokenPayload | null> {
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

  let keys: Map<string, CryptoKey>
  try {
    keys = await loadJwks(env)
  } catch (error) {
    console.error('Failed to load VMS JWKS', error)
    return null
  }

  const key =
    (header.kid ? keys.get(header.kid) : undefined) ||
    keys.values().next().value
  if (!key) return null

  const signature = new Uint8Array(base64UrlToBytes(signaturePart))
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
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
