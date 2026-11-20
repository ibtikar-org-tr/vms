/**
 * Accept absolute https/http redirect URIs whose origin is on the allowlist
 * (same list as CORS: CORS_ALLOW_ORIGINS + FRONTEND_BASE_URL [+ local defaults]).
 * Rejects relative paths, protocol-relative URLs, and unknown origins.
 */
export function getSafeExternalRedirectUri(
  redirectUri: string | null | undefined,
  allowedOrigins: string[],
): string | null {
  if (!redirectUri?.trim() || allowedOrigins.length === 0) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(redirectUri.trim())
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }

  // Block credentials in URL
  if (parsed.username || parsed.password) {
    return null
  }

  const origin = parsed.origin
  const allowed = allowedOrigins.some((entry) => entry === origin)
  if (!allowed) {
    return null
  }

  return parsed.toString()
}

export function externalRedirectUrisMatch(stored: string, provided: string): boolean {
  try {
    const a = new URL(stored.trim())
    const b = new URL(provided.trim())
    if (a.origin !== b.origin) return false

    const pathA = a.pathname.replace(/\/+$/, '') || '/'
    const pathB = b.pathname.replace(/\/+$/, '') || '/'
    if (pathA !== pathB) return false

    const keys = new Set([...a.searchParams.keys(), ...b.searchParams.keys()])
    for (const key of keys) {
      if (a.searchParams.get(key) !== b.searchParams.get(key)) return false
    }
    return true
  } catch {
    return stored.trim() === provided.trim()
  }
}
