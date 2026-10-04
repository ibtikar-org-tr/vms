import { useMemo, useState } from 'react'
import type { VmsEvent } from '../../../types/vms'
import { EventCard } from './EventCard'
import { normalizeToAsciiLower } from '../../../utils/normalizeText'
import { eventRichTextToPlain } from '../../../utils/event-rich-text'

type GroupKey = 'started' | 'ongoing' | 'ended'

function getEventGroup(eventItem: VmsEvent, now: Date): GroupKey {
  if (eventItem.startTime) {
    const startTime = new Date(eventItem.startTime)
    if (!Number.isNaN(startTime.getTime()) && startTime > now) {
      return 'started'
    }
  }

  if (!eventItem.endTime) {
    return 'ongoing'
  }

  const endTime = new Date(eventItem.endTime)
  if (Number.isNaN(endTime.getTime())) {
    return 'ongoing'
  }
  return endTime < now ? 'ended' : 'ongoing'
}

export function EventsCatalog({
  events,
  emptyMessage,
}: {
  events: VmsEvent[]
  emptyMessage: string
}) {
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')

  const now = new Date()
  const normalizedQuery = normalizeToAsciiLower(query.trim())

  const countryOptions = useMemo(() => {
    return Array.from(new Set(events.map((eventItem) => (eventItem.country ?? '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [events])

  const regionOptions = useMemo(() => {
    return Array.from(new Set(events.map((eventItem) => (eventItem.region ?? '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter((eventItem) => {
      const matchesCountry = countryFilter === 'all' || (eventItem.country ?? '').trim() === countryFilter
      const matchesRegion = regionFilter === 'all' || (eventItem.region ?? '').trim() === regionFilter
      const matchesSearch =
        !normalizedQuery ||
        normalizeToAsciiLower(eventItem.name).includes(normalizedQuery) ||
        normalizeToAsciiLower(eventRichTextToPlain(eventItem.description ?? '')).includes(normalizedQuery)

      return matchesCountry && matchesRegion && matchesSearch
    })
  }, [events, countryFilter, regionFilter, normalizedQuery])

  const groups = useMemo(() => {
    const upcomingAndOngoing: VmsEvent[] = []
    const ended: VmsEvent[] = []

    for (const eventItem of filteredEvents) {
      const group = getEventGroup(eventItem, now)
      if (group === 'started' || group === 'ongoing') {
        upcomingAndOngoing.push(eventItem)
      }
      if (group === 'ended') ended.push(eventItem)
    }

    return { upcomingAndOngoing, ended }
  }, [filteredEvents, now])

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">تصفية حسب الموقع</p>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            {filteredEvents.length} نتيجة
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الفعالية أو الوصف"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600"
          />
          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600"
          >
            <option value="all">كل الدول</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600"
          >
            <option value="all">كل المناطق</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">الفعاليات القادمة والقائمة</h3>
              <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                {groups.upcomingAndOngoing.length}
              </span>
            </div>
            {groups.upcomingAndOngoing.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                لا توجد فعاليات قادمة أو قائمة.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.upcomingAndOngoing.map((eventItem) => (
                  <EventCard key={eventItem.id} eventItem={eventItem} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">الفعاليات المنتهية</h3>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {groups.ended.length}
              </span>
            </div>
            {groups.ended.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                لا توجد فعاليات منتهية.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.ended.map((eventItem) => (
                  <EventCard key={eventItem.id} eventItem={eventItem} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
