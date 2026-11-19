export type IntegratedApp = {
  id: 'kitchen' | 'career'
  client: string
  nameAr: string
  descriptionAr: string
  url: string
}

function trimOrigin(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback
  return raw.replace(/\/+$/, '')
}

export function listIntegratedApps(): IntegratedApp[] {
  return [
    {
      id: 'kitchen',
      client: 'kitchen',
      nameAr: 'المطبخ',
      descriptionAr: 'منصة المطبخ والمسابقات المرتبطة بمنصة الأعضاء.',
      url: trimOrigin(import.meta.env.VITE_KITCHEN_URL as string | undefined, 'http://localhost:9682'),
    },
    {
      id: 'career',
      client: 'career',
      nameAr: 'المسار المهني',
      descriptionAr: 'السير الذاتية والخبرات المهنية للأعضاء.',
      url: trimOrigin(
        import.meta.env.VITE_CAREER_URL as string | undefined,
        'http://localhost:9692',
      ),
    },
  ]
}

export function getAppAuthCallbackUrl(appUrl: string, nextPath = '/'): string {
  const url = new URL('/auth/callback', `${appUrl}/`)
  if (nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}
