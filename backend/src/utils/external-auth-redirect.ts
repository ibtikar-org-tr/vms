/** Parse comma-separated allowlist of origins (scheme + host[+port]). */
export function parseExternalAuthRedirectOrigins(raw: string | undefined | null): string[] {
  if (!raw?.trim()) {
    return []
  }

  return raw
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * Accept absolute https/http redirect URIs whose origin is on the allowlist.
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
