const DEFAULT_VMS_LOGIN = 'https://vms.ibtikar.tr/login'

export function getVmsLoginUrl(): string {
  return (import.meta.env.VITE_VMS_LOGIN_URL as string | undefined)?.trim() || DEFAULT_VMS_LOGIN
}

export function getVmsProfileUrl(): string {
  const login = new URL(getVmsLoginUrl())
  login.pathname = '/profile'
  login.search = ''
  login.hash = ''
  return login.toString()
}

export function getCareerAuthCallbackUrl(nextPath?: string): string {
  if (typeof window === 'undefined') return '/auth/callback'
  const url = new URL('/auth/callback', window.location.origin)
  if (nextPath?.startsWith('/') && !nextPath.startsWith('//')) {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}

export function buildVmsSsoLoginUrl(nextPath?: string): string {
  const login = new URL(getVmsLoginUrl())
  login.searchParams.set('client', 'career')
  login.searchParams.set('redirect_uri', getCareerAuthCallbackUrl(nextPath))
  return login.toString()
}

export function startVmsSsoLogin(nextPath?: string): void {
  window.location.assign(buildVmsSsoLoginUrl(nextPath))
}
