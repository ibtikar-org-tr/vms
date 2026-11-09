import { Link } from 'react-router-dom'
import { CalendarDays, MapPin } from 'lucide-react'
import type { VmsEvent } from '../../../types/vms'
import { formatDateEnCA } from '../../../utils/date-format'
import { eventRichTextToPlain } from '../../../utils/event-rich-text'

export function EventCard({ eventItem }: { eventItem: VmsEvent }) {
  const locationLabel = [eventItem.region, eventItem.country].filter(Boolean).join(' · ')
  const descriptionPreview = eventRichTextToPlain(eventItem.description ?? '')

  return (
    <Link
      to={`/event/${eventItem.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
    >
      <div className="relative aspect-[21/9] overflow-hidden bg-linear-to-br from-cyan-50 to-slate-100">
        {eventItem.imageUrl ? (
          <img
            src={eventItem.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-10 w-10 text-slate-300 sm:h-12 sm:w-12" strokeWidth={1.25} />
          </div>
        )}

        <div className="absolute top-3 start-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDateEnCA(eventItem.startTime)}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 className="text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">{eventItem.name}</h3>

        {locationLabel ? (
          <p className="inline-flex max-w-full items-center gap-1 text-xs text-slate-500 sm:text-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </p>
        ) : null}

        {descriptionPreview ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-sm">{descriptionPreview}</p>
        ) : null}
      </div>
    </Link>
  )
}
