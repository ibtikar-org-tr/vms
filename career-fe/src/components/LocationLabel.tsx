import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { findCountryByNameAr } from '../lib/countries'
import { locationLabel, type WorkLocationPref } from '../lib/work-preferences'

type Props = {
  location: WorkLocationPref
  className?: string
}

export function LocationLabel({ location, className = '' }: Props) {
  const [emoji, setEmoji] = useState('')

  useEffect(() => {
    if (location.kind !== 'country' || !location.countryName) {
      setEmoji('')
      return
    }
    let alive = true
    void findCountryByNameAr(location.countryName).then((country) => {
      if (alive) setEmoji(country?.emoji || '')
    })
    return () => {
      alive = false
    }
  }, [location.kind, location.countryName])

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {location.kind === 'remote' ? (
        <Globe className="h-4 w-4 shrink-0 text-brand" aria-hidden />
      ) : emoji ? (
        <span className="text-base leading-none" aria-hidden>
          {emoji}
        </span>
      ) : (
        <span className="inline-block h-4 w-4 shrink-0 rounded-sm bg-slate-100" aria-hidden />
      )}
      <span>{locationLabel(location)}</span>
    </span>
  )
}
