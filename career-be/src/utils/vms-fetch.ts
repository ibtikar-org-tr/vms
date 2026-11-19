import type { Environment } from '../types/env'

const MEMBERSHIP_API_PREFIX = '/ms/membership-app/api'

/**
 * Call the membership-app API.
 * Prefer the service binding so same-zone Worker→Worker calls don't skip routes
 * and hit the SPA (same pattern as telegram-ms).
 */
export async function fetchVmsApi(
  env: Environment,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const service = env.MEMBERSHIP_MS_SERVICE

  if (service) {
    return service.fetch(`https://membership-ms.internal${MEMBERSHIP_API_PREFIX}${normalizedPath}`, init)
  }

  const apiBase = env.VMS_API_BASE?.trim().replace(/\/+$/, '')
  if (!apiBase) {
    throw new Error('VMS_API_BASE is not configured and MEMBERSHIP_MS_SERVICE is missing')
  }

  return fetch(`${apiBase}${normalizedPath}`, init)
}
