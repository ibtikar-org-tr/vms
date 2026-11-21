export type CountryOption = {
  id: number
  iso2: string
  nameEn: string
  nameAr: string
  native: string
  emoji: string
  phoneCode: string
}

export const PINNED_COUNTRY_ISO2 = ['SY', 'TR'] as const

type RawCountry = {
  id: number
  iso2: string
  name: string
  native?: string
  emoji?: string
  phone_code?: string
}

let cached: CountryOption[] | null = null
let loading: Promise<CountryOption[]> | null = null

function arabicNameFor(iso2: string, fallback: string) {
  const code = iso2.toUpperCase()
  if (code === 'IL') return 'فلسطين المحتلة'

  if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
    const localized = new Intl.DisplayNames(['ar'], { type: 'region' }).of(code)
    if (localized && localized !== code) return localized
  }
  return fallback
}

/** Normalize Arabic/Latin text for search matching. */
export function normalizeSearchText(text: string) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isPinnedCountryIso(iso2: string) {
  return (PINNED_COUNTRY_ISO2 as readonly string[]).includes(iso2.toUpperCase())
}

export function isSyriaName(name: string | null | undefined) {
  const n = normalizeSearchText(name || '')
  return n === normalizeSearchText('سوريا') || n === 'syria'
}

export function isTurkeyName(name: string | null | undefined) {
  const n = normalizeSearchText(name || '')
  return (
    n === normalizeSearchText('تركيا') ||
    n === 'turkey' ||
    n === 'turkiye' ||
    n === normalizeSearchText('türkiye')
  )
}

export function sortCountryOptions(countries: CountryOption[]): CountryOption[] {
  const byIso = new Map(countries.map((c) => [c.iso2, c]))
  const pinned = PINNED_COUNTRY_ISO2.map((iso) => byIso.get(iso)).filter(
    (c): c is CountryOption => Boolean(c),
  )
  const pinnedSet = new Set(pinned.map((c) => c.iso2))
  const rest = countries
    .filter((c) => !pinnedSet.has(c.iso2))
    .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
  return [...pinned, ...rest]
}

export function countryMatchesQuery(country: CountryOption, query: string) {
  const q = query.trim()
  if (!q) return true
  const qNorm = normalizeSearchText(q)
  if (!qNorm) return true

  const haystacks = [
    country.nameAr,
    country.nameEn,
    country.native,
    country.iso2,
    country.phoneCode,
  ]
  return haystacks.some((value) => {
    const hay = normalizeSearchText(value)
    return hay.includes(qNorm) || value.includes(q)
  })
}

export async function loadCountryOptions(): Promise<CountryOption[]> {
  if (cached) return cached
  if (loading) return loading

  loading = import('react-country-state-city')
    .then(({ GetCountries }) => GetCountries() as Promise<RawCountry[]>)
    .then((countries) => {
      const mapped = countries.map((country) => ({
        id: country.id,
        iso2: country.iso2.toUpperCase(),
        nameEn: country.name,
        nameAr: arabicNameFor(country.iso2, country.name),
        native: country.native || '',
        emoji: country.emoji || '',
        phoneCode: country.phone_code ? `+${country.phone_code}` : '',
      }))
      cached = sortCountryOptions(mapped)
      return cached
    })
    .finally(() => {
      loading = null
    })

  return loading
}

export async function findCountryByNameAr(nameAr: string): Promise<CountryOption | null> {
  const list = await loadCountryOptions()
  const target = normalizeSearchText(nameAr)
  return (
    list.find((c) => normalizeSearchText(c.nameAr) === target) ||
    list.find((c) => normalizeSearchText(c.nameEn) === target) ||
    null
  )
}
