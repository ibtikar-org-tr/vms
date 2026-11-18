import {
  formatSalaryRange,
  jobTypeLabel,
  locationLabel,
  type OpenJobType,
  type WorkLocationPref,
  type WorkPreferences,
} from './work-preferences'

export type LanguagePrefSnapshot = {
  language: string
  proficiency: number | null
  openToTranslate: boolean
}

export type ProfileDraftSnapshot = {
  summary: string
  languages: LanguagePrefSnapshot[]
  workPreferences: WorkPreferences
}

export type ChangelogKind = 'added' | 'removed' | 'changed'

export type ChangelogEntry = {
  id: string
  section: string
  kind: ChangelogKind
  label: string
  before?: string
  after?: string
}

function normText(value: string | null | undefined) {
  return String(value ?? '').trim()
}

function displayText(value: string | null | undefined, empty = '—') {
  const text = normText(value)
  return text || empty
}

function proficiencyLabel(value: number | null) {
  return value == null ? 'غير محدد' : `${value}/10`
}

function translateLabel(value: boolean) {
  return value ? 'نعم' : 'لا'
}

function relocateLabel(value: boolean) {
  return value ? 'نعم' : 'لا'
}

function jobTypesLabel(types: OpenJobType[]) {
  if (!types.length) return 'لا يوجد'
  return types.map((id) => jobTypeLabel(id, 'ar')).join('، ')
}

function locationKey(loc: WorkLocationPref) {
  return loc.kind === 'remote' ? 'remote' : `country:${(loc.countryName || '').toLowerCase()}`
}

function locationDetail(loc: WorkLocationPref) {
  const salary = formatSalaryRange(loc.salaryMin, loc.salaryMax, loc.currency)
  return salary ? `${locationLabel(loc)} — ${salary}` : locationLabel(loc)
}

function sameLocation(a: WorkLocationPref, b: WorkLocationPref) {
  return (
    a.kind === b.kind &&
    normText(a.countryName).toLowerCase() === normText(b.countryName).toLowerCase() &&
    a.salaryMin === b.salaryMin &&
    a.salaryMax === b.salaryMax &&
    (a.currency || 'USD').toUpperCase() === (b.currency || 'USD').toUpperCase()
  )
}

function pushChange(
  entries: ChangelogEntry[],
  entry: Omit<ChangelogEntry, 'id'> & { id?: string },
) {
  entries.push({
    id: entry.id || `${entry.section}-${entry.label}-${entries.length}`,
    ...entry,
  })
}

export function snapshotFromDraft(input: {
  summary: string
  languages: LanguagePrefSnapshot[]
  workPreferences: WorkPreferences
}): ProfileDraftSnapshot {
  return {
    summary: normText(input.summary),
    languages: input.languages.map((item) => ({
      language: item.language,
      proficiency: item.proficiency,
      openToTranslate: Boolean(item.openToTranslate),
    })),
    workPreferences: {
      canRelocate: Boolean(input.workPreferences.canRelocate),
      relocateNotes: normText(input.workPreferences.relocateNotes),
      jobTypes: [...input.workPreferences.jobTypes],
      locations: input.workPreferences.locations.map((loc) => ({
        kind: loc.kind,
        countryName: loc.countryName,
        salaryMin: loc.salaryMin,
        salaryMax: loc.salaryMax,
        currency: (loc.currency || 'USD').toUpperCase(),
      })),
    },
  }
}

export function buildProfileChangelog(
  before: ProfileDraftSnapshot,
  after: ProfileDraftSnapshot,
): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []

  if (before.summary !== after.summary) {
    pushChange(entries, {
      section: 'الملخص',
      kind: 'changed',
      label: 'نبذة تعريفية',
      before: displayText(before.summary, '(فارغ)'),
      after: displayText(after.summary, '(فارغ)'),
    })
  }

  const beforeLangs = new Map(before.languages.map((item) => [item.language, item]))
  const afterLangs = new Map(after.languages.map((item) => [item.language, item]))
  const allLangNames = Array.from(new Set([...beforeLangs.keys(), ...afterLangs.keys()]))

  for (const language of allLangNames) {
    const prev = beforeLangs.get(language)
    const next = afterLangs.get(language)
    if (!prev && next) {
      pushChange(entries, {
        section: 'اللغات',
        kind: 'added',
        label: language,
        after: `إتقان ${proficiencyLabel(next.proficiency)} · ترجمة: ${translateLabel(next.openToTranslate)}`,
      })
      continue
    }
    if (prev && !next) {
      pushChange(entries, {
        section: 'اللغات',
        kind: 'removed',
        label: language,
        before: `إتقان ${proficiencyLabel(prev.proficiency)} · ترجمة: ${translateLabel(prev.openToTranslate)}`,
      })
      continue
    }
    if (!prev || !next) continue

    if (prev.proficiency !== next.proficiency) {
      pushChange(entries, {
        section: 'اللغات',
        kind: 'changed',
        label: `${language} — مستوى الإتقان`,
        before: proficiencyLabel(prev.proficiency),
        after: proficiencyLabel(next.proficiency),
      })
    }
    if (prev.openToTranslate !== next.openToTranslate) {
      pushChange(entries, {
        section: 'اللغات',
        kind: 'changed',
        label: `${language} — العمل كمترجم`,
        before: translateLabel(prev.openToTranslate),
        after: translateLabel(next.openToTranslate),
      })
    }
  }

  const prevWork = before.workPreferences
  const nextWork = after.workPreferences

  if (prevWork.canRelocate !== nextWork.canRelocate) {
    pushChange(entries, {
      section: 'تفضيلات العمل',
      kind: 'changed',
      label: 'إمكانية الانتقال',
      before: relocateLabel(prevWork.canRelocate),
      after: relocateLabel(nextWork.canRelocate),
    })
  }

  if (prevWork.relocateNotes !== nextWork.relocateNotes) {
    pushChange(entries, {
      section: 'تفضيلات العمل',
      kind: 'changed',
      label: 'تفاصيل الانتقال',
      before: displayText(prevWork.relocateNotes, '(فارغ)'),
      after: displayText(nextWork.relocateNotes, '(فارغ)'),
    })
  }

  const prevJobs = [...prevWork.jobTypes].sort().join('|')
  const nextJobs = [...nextWork.jobTypes].sort().join('|')
  if (prevJobs !== nextJobs) {
    pushChange(entries, {
      section: 'تفضيلات العمل',
      kind: 'changed',
      label: 'أنواع العمل المتاحة',
      before: jobTypesLabel(prevWork.jobTypes),
      after: jobTypesLabel(nextWork.jobTypes),
    })
  }

  const prevLocs = new Map(prevWork.locations.map((loc) => [locationKey(loc), loc]))
  const nextLocs = new Map(nextWork.locations.map((loc) => [locationKey(loc), loc]))
  const allLocKeys = Array.from(new Set([...prevLocs.keys(), ...nextLocs.keys()]))

  for (const key of allLocKeys) {
    const prev = prevLocs.get(key)
    const next = nextLocs.get(key)
    if (!prev && next) {
      pushChange(entries, {
        section: 'أماكن العمل والراتب',
        kind: 'added',
        label: locationLabel(next),
        after: locationDetail(next),
      })
      continue
    }
    if (prev && !next) {
      pushChange(entries, {
        section: 'أماكن العمل والراتب',
        kind: 'removed',
        label: locationLabel(prev),
        before: locationDetail(prev),
      })
      continue
    }
    if (!prev || !next) continue
    if (!sameLocation(prev, next)) {
      pushChange(entries, {
        section: 'أماكن العمل والراتب',
        kind: 'changed',
        label: locationLabel(next),
        before: locationDetail(prev),
        after: locationDetail(next),
      })
    }
  }

  return entries
}

export function groupChangelog(entries: ChangelogEntry[]) {
  const order: string[] = []
  const groups = new Map<string, ChangelogEntry[]>()
  for (const entry of entries) {
    if (!groups.has(entry.section)) {
      groups.set(entry.section, [])
      order.push(entry.section)
    }
    groups.get(entry.section)!.push(entry)
  }
  return order.map((section) => ({ section, entries: groups.get(section)! }))
}
