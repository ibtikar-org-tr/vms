import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Globe, Search } from 'lucide-react'
import {
  countryMatchesQuery,
  loadCountryOptions,
  type CountryOption,
} from '../lib/countries'

export type LocationPick =
  | { kind: 'remote' }
  | { kind: 'country'; countryName: string; option: CountryOption }

type Props = {
  onPick: (pick: LocationPick) => void
  placeholder?: string
  disabled?: boolean
  excludeNames?: string[]
  excludeRemote?: boolean
}

export function CountrySelect({
  onPick,
  placeholder = 'ابحث واختر الدولة',
  disabled,
  excludeNames = [],
  excludeRemote = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void loadCountryOptions()
      .then((list) => {
        if (alive) setCountries(list)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const excluded = useMemo(
    () => new Set(excludeNames.map((name) => name.trim().toLowerCase()).filter(Boolean)),
    [excludeNames],
  )

  const filtered = useMemo(() => {
    const available = countries.filter((country) => !excluded.has(country.nameAr.toLowerCase()))
    const q = query.trim()
    if (!q) return available
    return available.filter((country) => countryMatchesQuery(country, q))
  }, [countries, excluded, query])

  const showRemote = !excludeRemote && countryMatchesQuery(
    {
      id: -1,
      iso2: 'XX',
      nameEn: 'Remote',
      nameAr: 'عن بعد Remote',
      native: 'عن بعد',
      emoji: '',
      phoneCode: '',
    },
    query,
  )

  return (
    <div className="relative min-w-[14rem] flex-1" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || loading}
        className="field flex w-full items-center justify-between gap-2 text-start"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-slate-400">
          {loading ? 'جاري تحميل الدول…' : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-white">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className="field ps-8"
              autoFocus
              dir="auto"
              lang="ar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالعربية أو الإنجليزية أو الرمز"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {showRemote ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-line px-2.5 py-2 text-start text-sm transition hover:bg-slate-50"
                  onClick={() => {
                    onPick({ kind: 'remote' })
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-brand">
                    <Globe className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-slate-800">عن بُعد (Remote)</span>
                </button>
              </li>
            ) : null}
            {filtered.map((country) => (
              <li key={country.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-start text-sm transition hover:bg-slate-50"
                  onClick={() => {
                    onPick({
                      kind: 'country',
                      countryName: country.nameAr,
                      option: country,
                    })
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="text-base leading-none">{country.emoji}</span>
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{country.nameAr}</span>
                  <span className="text-[11px] text-slate-400" dir="ltr">
                    {country.iso2}
                  </span>
                </button>
              </li>
            ))}
            {!showRemote && !filtered.length && (
              <li className="px-3 py-4 text-center text-xs text-slate-400">لا توجد نتائج</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
