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
]

function isLocalWorkerRequest(c: Context<{ Bindings: AppBindings }>): boolean {
  const hostname = new URL(c.req.url).hostname
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function parseOriginList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return []
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function buildAllowedOrigins(c: Context<{ Bindings: AppBindings }>): Set<string> {
  const allowed = new Set<string>()

  for (const origin of parseOriginList(c.env.CORS_ALLOW_ORIGINS)) {
    allowed.add(origin)
  }

  const frontendBaseUrl = c.env.FRONTEND_BASE_URL?.trim()
  if (frontendBaseUrl) {
    allowed.add(frontendBaseUrl)
  }

  if (isLocalWorkerRequest(c)) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowed.add(origin)
    }
  }

  return allowed
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
  })
}
