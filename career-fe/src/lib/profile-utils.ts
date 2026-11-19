export function splitCsv(value?: string | null): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[,،\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function sexLabel(sex?: string | null) {
  if (sex === 'male') return 'ذكر'
  if (sex === 'female') return 'أنثى'
  return '—'
}

export function formatBirthDate(value?: string | null) {
  if (!value?.trim()) return null
  const raw = value.trim()
  // Prefer YYYY-MM-DD display; fall back to original string.
  const iso = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return raw
}

export function formatLocation(parts: {
  country?: string | null
  region?: string | null
  city?: string | null
}, separator = ' · ') {
  return [parts.country, parts.region, parts.city].filter(Boolean).join(separator) || null
}

export function formatDateRange(
  start?: string | null,
  end?: string | null,
  ongoing?: boolean,
  ongoingLabel = 'حالياً',
) {
  const from = start || '؟'
  const to = ongoing ? ongoingLabel : end || '؟'
  return `${from} — ${to}`
}

export function displayNameOf(data: {
  vmsProfile?: { arName?: string | null; enName?: string | null } | null
  profile?: { membership_number?: string }
  membershipNumber?: string
}) {
  return (
    data.vmsProfile?.arName ||
    data.vmsProfile?.enName ||
    data.profile?.membership_number ||
    data.membershipNumber ||
    '—'
  )
}

export function latestRoleOf(workExperiences?: Array<{ is_current?: boolean; title?: string }>) {
  return (
    workExperiences?.find((w) => w.is_current)?.title || workExperiences?.[0]?.title || null
  )
}
