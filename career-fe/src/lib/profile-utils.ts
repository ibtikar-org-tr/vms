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
