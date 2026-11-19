import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppBindings } from '../types/bindings'

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5930',
  'http://127.0.0.1:5930',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:9682',
  'http://127.0.0.1:9682',
  'http://localhost:9692',
  'http://127.0.0.1:9692',
  'http://localhost:5925',
  'http://127.0.0.1:5925',
]

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function parseOriginList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return []
  }

  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/** Shared allowlist for CORS and external SSO redirect_uri. */
export function listAllowedBrowserOrigins(
  env: Pick<AppBindings, 'CORS_ALLOW_ORIGINS' | 'FRONTEND_BASE_URL'>,
  requestHostname?: string,
): string[] {
  const allowed = new Set<string>()

  for (const origin of parseOriginList(env.CORS_ALLOW_ORIGINS)) {
    allowed.add(origin)
  }

  const frontendBaseUrl = env.FRONTEND_BASE_URL?.trim().replace(/\/+$/, '')
  if (frontendBaseUrl) {
    try {
      allowed.add(new URL(frontendBaseUrl).origin)
    } catch {
      allowed.add(frontendBaseUrl)
    }
  }

  if (requestHostname && isLocalHostname(requestHostname)) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowed.add(origin)
    }
  }

  return [...allowed]
}

function buildAllowedOrigins(c: Context<{ Bindings: AppBindings }>): Set<string> {
  const hostname = new URL(c.req.url).hostname
  return new Set(listAllowedBrowserOrigins(c.env, hostname))
}

export function membershipAppCors() {
  return cors({
    origin: (origin, c) => {
      if (!origin) {
        return ''
      }

      const allowed = buildAllowedOrigins(c as Context<{ Bindings: AppBindings }>)
      return allowed.has(origin) ? origin : ''
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    exposeHeaders: ['Content-Disposition', 'Content-Type'],
  })
}
