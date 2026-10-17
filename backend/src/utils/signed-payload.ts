export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(normalized + padding)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index]
  }

  return diff === 0
}

export async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return bytesToBase64Url(new Uint8Array(signature))
}

export async function createSignedToken(secret: string, payload: unknown): Promise<string> {
  const payloadEncoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await signPayload(secret, payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export async function readSignedToken<T>(secret: string, token: string): Promise<T | null> {
  const [payloadPart, signaturePart] = token.split('.')
  if (!payloadPart || !signaturePart || token.split('.').length !== 2) {
    return null
  }

  const expectedSignature = await signPayload(secret, payloadPart)
  const expectedBytes = base64UrlToBytes(expectedSignature)
  const receivedBytes = base64UrlToBytes(signaturePart)

  if (!safeEqual(expectedBytes, receivedBytes)) {
    return null
  }

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as T
  } catch {
    return null
  }
}
