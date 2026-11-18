export type OpenJobType = 'full_time' | 'part_time' | 'temp_full_time'

export const JOB_TYPE_OPTIONS: Array<{ id: OpenJobType; labelAr: string; labelEn: string }> = [
  { id: 'full_time', labelAr: 'دوام كامل', labelEn: 'Full-time' },
  { id: 'part_time', labelAr: 'دوام جزئي', labelEn: 'Part-time' },
  { id: 'temp_full_time', labelAr: 'دوام كامل مؤقت', labelEn: 'Temporary full-time' },
]

export type WorkLocationPref = {
  kind: 'remote' | 'country'
  countryName: string | null
  salaryMin: number | null
  salaryMax: number | null
  currency: string
}

export type WorkPreferences = {
  canRelocate: boolean
  relocateNotes: string
  jobTypes: OpenJobType[]
  locations: WorkLocationPref[]
}

export function emptyWorkPreferences(): WorkPreferences {
  return {
    canRelocate: false,
    relocateNotes: '',
    jobTypes: [],
    locations: [
      {
        kind: 'remote',
        countryName: null,
        salaryMin: null,
        salaryMax: null,
        currency: 'USD',
      },
    ],
  }
}

function normalizeJobTypes(raw: unknown): OpenJobType[] {
  const allowed = new Set(JOB_TYPE_OPTIONS.map((o) => o.id))
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,|]/)
      : []
  const seen = new Set<OpenJobType>()
  for (const item of values) {
    const key = String(item || '').trim() as OpenJobType
    if (allowed.has(key)) seen.add(key)
  }
  return JOB_TYPE_OPTIONS.map((o) => o.id).filter((id) => seen.has(id))
}

export function jobTypeLabel(id: OpenJobType, lang: 'ar' | 'en' = 'ar') {
  const match = JOB_TYPE_OPTIONS.find((o) => o.id === id)
  if (!match) return id
  return lang === 'en' ? match.labelEn : match.labelAr
}

export function normalizeWorkPreferences(raw: any): WorkPreferences {
  const base = emptyWorkPreferences()
  if (!raw || typeof raw !== 'object') return base

  const locations: WorkLocationPref[] = Array.isArray(raw.locations)
    ? raw.locations
        .map((item: any): WorkLocationPref | null => {
          if (item?.kind === 'remote') {
            return {
              kind: 'remote',
              countryName: null,
              salaryMin: item.salaryMin == null || item.salaryMin === '' ? null : Number(item.salaryMin),
              salaryMax: item.salaryMax == null || item.salaryMax === '' ? null : Number(item.salaryMax),
              currency: String(item.currency || 'USD').toUpperCase(),
            }
          }
          const countryName = String(item?.countryName || '').trim()
          if (!countryName) return null
          return {
            kind: 'country',
            countryName,
            salaryMin: item.salaryMin == null || item.salaryMin === '' ? null : Number(item.salaryMin),
            salaryMax: item.salaryMax == null || item.salaryMax === '' ? null : Number(item.salaryMax),
            currency: String(item.currency || 'USD').toUpperCase(),
          }
        })
        .filter(Boolean)
    : []

  const hasRemote = locations.some((loc) => loc.kind === 'remote')
  const ordered = [
    ...(hasRemote
      ? locations.filter((loc) => loc.kind === 'remote').slice(0, 1)
      : [base.locations[0]]),
    ...locations.filter((loc) => loc.kind === 'country'),
  ]

  return {
    canRelocate: Boolean(raw.canRelocate ?? raw.can_relocate),
    relocateNotes: String(raw.relocateNotes ?? raw.relocate_notes ?? ''),
    jobTypes: normalizeJobTypes(raw.jobTypes ?? raw.open_job_types),
    locations: ordered,
  }
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = 'USD',
) {
  const cur = currency || 'USD'
  if (min == null && max == null) return null
  if (min != null && max != null) return `${min.toLocaleString()} – ${max.toLocaleString()} ${cur}`
  if (min != null) return `من ${min.toLocaleString()} ${cur}`
  return `حتى ${Number(max).toLocaleString()} ${cur}`
}

export function locationLabel(loc: WorkLocationPref) {
  return loc.kind === 'remote' ? 'عن بُعد (Remote)' : loc.countryName || '—'
}
