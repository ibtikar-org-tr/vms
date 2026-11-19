export function publicCvUrl(membershipNumber: string) {
  const origin =
    (typeof window !== 'undefined' && window.location.origin) ||
    (import.meta.env.VITE_CAREER_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ||
    ''
  return `${origin}/talent/${encodeURIComponent(membershipNumber)}`
}

export function careerAssetUrl(path: string) {
  const origin =
    (typeof window !== 'undefined' && window.location.origin) ||
    (import.meta.env.VITE_CAREER_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') ||
    ''
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
