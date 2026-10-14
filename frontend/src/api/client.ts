import type { RefreshResponse } from '../types/auth'
import { clearStoredAuth, getAccessToken, setAccessToken, setStoredUser } from '../utils/auth'

const MEMBER_MS_BASE_URL = (import.meta.env.VITE_MEMBER_MS as string | undefined)?.trim()
export const API_BASE = MEMBER_MS_BASE_URL ? `${MEMBER_MS_BASE_URL.replace(/\/+$/, '')}/api` : '/ms/membership-app/api'

let refreshInFlight: Promise<boolean> | null = null

async function parseErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error
    }
  } catch {
    // ignore
  }

  return fallbackMessage
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      return false
    }

    const payload = (await response.json()) as RefreshResponse
    setAccessToken(payload.accessToken)
    setStoredUser(payload.user)
    return true
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export async function fetchPublicJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }

  return (await response.json()) as T
}

export async function apiFetch(path: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<Response> {
  const headers = new Headers(init.headers)
  const accessToken = getAccessToken()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  const isAuthEndpoint =
    path.startsWith('/login') || path.startsWith('/refresh') || path.startsWith('/registration')

  if (response.status === 401 && retryOnUnauthorized && !isAuthEndpoint) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiFetch(path, init, false)
    }

    clearStoredAuth()
  }

  return response
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { method: 'GET' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }
  return (await response.json()) as T
}

export async function apiPostJson<TResponse, TPayload>(
  path: string,
  payload: TPayload,
  options?: { auth?: boolean },
): Promise<TResponse> {
  const useAuth = options?.auth !== false
  const response = useAuth
    ? await apiFetch(path, { method: 'POST', body: JSON.stringify(payload) })
    : await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }

  return (await response.json()) as TResponse
}

export async function apiPutJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await apiFetch(path, { method: 'PUT', body: JSON.stringify(payload) })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }
  return (await response.json()) as TResponse
}

export async function apiDelete(path: string): Promise<void> {
  const response = await apiFetch(path, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const response = await apiFetch(path, { method: 'GET' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Request failed (${response.status})`))
  }

  const disposition = response.headers.get('Content-Disposition')
  const filenameMatch = disposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  const encodedName = filenameMatch?.[1]
  const plainName = filenameMatch?.[2]
  const filename = encodedName ? decodeURIComponent(encodedName) : plainName || null

  return { blob: await response.blob(), filename }
}

export async function logoutRequest() {
  clearStoredAuth()
  try {
    await apiFetch('/logout', { method: 'POST' }, false)
  } catch {
    // Local session is already cleared; ignore network errors during logout.
  }
}
