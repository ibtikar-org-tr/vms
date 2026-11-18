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
  locations: WorkLocationPref[]
}

export function emptyWorkPreferences(): WorkPreferences {
  return {
    canRelocate: false,
    relocateNotes: '',
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
