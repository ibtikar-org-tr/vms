export type CountryOption = {
  id: number
  iso2: string
  nameEn: string
  nameAr: string
  emoji: string
  phoneCode: string
}

type RawCountry = {
  id: number
  iso2: string
  name: string
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

export async function loadCountryOptions(): Promise<CountryOption[]> {
  if (cached) return cached
  if (loading) return loading

  loading = import('react-country-state-city')
    .then(({ GetCountries }) => GetCountries() as Promise<RawCountry[]>)
    .then((countries) => {
      cached = countries
        .map((country) => ({
          id: country.id,
          iso2: country.iso2.toUpperCase(),
          nameEn: country.name,
          nameAr: arabicNameFor(country.iso2, country.name),
          emoji: country.emoji || '',
          phoneCode: country.phone_code ? `+${country.phone_code}` : '',
        }))
        .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
      return cached
    })
    .finally(() => {
      loading = null
    })

  return loading
}
