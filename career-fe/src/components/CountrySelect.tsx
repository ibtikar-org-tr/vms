import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { loadCountryOptions, type CountryOption } from '../lib/countries'

type Props = {
  value: string
  onChange: (countryNameAr: string, option: CountryOption | null) => void
  placeholder?: string
  disabled?: boolean
  excludeNames?: string[]
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function CountrySelect({
  value,
  onChange,
  placeholder = 'ابحث واختر الدولة',
  disabled,
  excludeNames = [],
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
    const qLower = q.toLowerCase()
    const qNorm = normalize(q)
    return available.filter((country) => {
      return (
        country.nameAr.includes(q) ||
        country.nameAr.toLowerCase().includes(qLower) ||
        normalize(country.nameEn).includes(qNorm) ||
        country.iso2.toLowerCase().includes(qNorm.replace(/[^a-z]/g, ''))
      )
    })
  }, [countries, excluded, query])

  const selected = countries.find((country) => country.nameAr === value) || null

  return (
    <div className="relative min-w-[14rem] flex-1" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || loading}
        className="field flex w-full items-center justify-between gap-2 text-start"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {loading ? 'جاري تحميل الدول…' : selected ? `${selected.emoji} ${selected.nameAr}` : placeholder}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن الدولة أو الرمز (TR, DE…)"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.map((country) => (
              <li key={country.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-start text-sm transition hover:bg-slate-50"
                  onClick={() => {
                    onChange(country.nameAr, country)
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
            {!filtered.length && (
              <li className="px-3 py-4 text-center text-xs text-slate-400">لا توجد نتائج</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
