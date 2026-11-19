export interface VmsAccessTokenPayload {
  sub: string
  email: string
  role: string
  type: 'access'
  exp: number
  iat: number
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

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

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index]
  }
  return diff === 0
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bytesToBase64Url(new Uint8Array(signature))
}

export async function verifyVmsAccessToken(
  secret: string,
  token: string,
): Promise<VmsAccessTokenPayload | null> {
  const [payloadPart, signaturePart] = token.split('.')
  if (!payloadPart || !signaturePart) return null

  const expectedSignature = await signPayload(secret, payloadPart)
  if (!safeEqual(base64UrlToBytes(expectedSignature), base64UrlToBytes(signaturePart))) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)))
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object') return null

  const sub = 'sub' in payload ? payload.sub : undefined
  const email = 'email' in payload ? payload.email : undefined
  const role = 'role' in payload ? payload.role : undefined
  const type = 'type' in payload ? payload.type : undefined
  const exp = 'exp' in payload ? payload.exp : undefined

  if (
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
    sub,
    email,
    role,
    type: 'access',
    exp,
    iat: 'iat' in payload && typeof payload.iat === 'number' ? payload.iat : 0,
  }
}
