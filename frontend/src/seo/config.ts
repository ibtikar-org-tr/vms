export const SITE_NAME = 'منصة أعضاء إبتكار'
export const ORGANIZATION_NAME = 'تجمّع إبتكار'
export const SITE_LOCALE = 'ar_AR'
export const SITE_LANGUAGE = 'ar'
export const DEFAULT_DESCRIPTION =
  'منصة أعضاء إبتكار لإدارة العضويات والتطوع والفعاليات والمشاريع، والاطلاع على الإحصاءات والفرص والأنشطة المتاحة للأعضاء.'
export const DEFAULT_OG_IMAGE = '/square_logo.svg'
export const DEFAULT_KEYWORDS =
  'إبتكار, تجمّع إبتكار, عضوية, تطوع, فعاليات, مشاريع, شباب, تركيا, منصة الأعضاء'

export const PUBLIC_INDEXABLE_ROUTES = [
  { path: '', changefreq: 'weekly', priority: '1.0' },
  { path: 'signup', changefreq: 'monthly', priority: '0.9' },
  { path: 'registration', changefreq: 'monthly', priority: '0.5' },
  { path: 'telegram-bot', changefreq: 'monthly', priority: '0.8' },
] as const

export const PRIVATE_ROUTE_PREFIXES = ['dashboard', 'login', 'iforgot', 'reset-password'] as const

export function getRouterBasePath(): string {
  const configured = import.meta.env.VITE_BASE_PATH as string | undefined

  if (!configured || configured === '/.') {
    return '/'
  }

  return configured.endsWith('/') ? configured : `${configured}/`
}

export function getSiteOrigin(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'https://ibtikar.tr'
}

export function joinUrl(origin: string, basePath: string, routePath = ''): string {
  const normalizedOrigin = origin.replace(/\/+$/, '')
  const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/+$/, '')
  const normalizedRoute = routePath.replace(/^\/+/, '').replace(/\/+$/, '')

  if (!normalizedRoute) {
    return `${normalizedOrigin}${normalizedBase}/`
  }

  return `${normalizedOrigin}${normalizedBase}/${normalizedRoute}`
}

export function resolveAssetUrl(assetPath: string): string {
  const origin = getSiteOrigin()
  const basePath = getRouterBasePath()
  const normalizedAsset = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
  return joinUrl(origin, basePath, normalizedAsset)
}

export function resolveCanonicalUrl(routePath?: string): string {
  const origin = getSiteOrigin()
  const basePath = getRouterBasePath()

  if (routePath !== undefined) {
    const normalizedRoute = routePath === '/' ? '' : routePath.replace(/^\/+/, '')
    return joinUrl(origin, basePath, normalizedRoute)
  }

  if (typeof window !== 'undefined') {
    const current = window.location.pathname
    const normalized = current.endsWith('/') && current !== '/' ? current.slice(0, -1) : current
    return `${origin}${normalized || '/'}`
  }

  return joinUrl(origin, basePath)
}
