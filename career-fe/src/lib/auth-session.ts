const TOKEN_KEY = 'career_token'
const SESSION_KEY = 'career_session'

export type CareerSessionUser = {
  membershipNumber: string
  email: string
  role: string
}

export type CareerSession = {
  user: CareerSessionUser
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)?.trim() || null
}

export function getSession(): CareerSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CareerSession
    if (!parsed?.user?.membershipNumber || !parsed?.user?.email) return null
    return parsed
  } catch {
    return null
  }
}

export function setSession(token: string, session: CareerSession) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(SESSION_KEY)
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken())
}
