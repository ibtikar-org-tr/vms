import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { profilesApi } from '../services/api'

export default function TalentPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [q, setQ] = useState('')

  const load = async (query?: string) => {
    const data = await profilesApi.discover(query)
    setProfiles(data.profiles || [])
  }

  useEffect(() => {
    void load().catch((err) => toast.error(err?.response?.data?.message || 'تعذّر تحميل السير'))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="page-kicker">اكتشاف</p>
        <h1 className="page-title">السير المنشورة</h1>
        <p className="page-desc">للمراجعة اليدوية من فريق إبتكار.</p>
      </div>

      <form
        className="flex max-w-xl flex-wrap gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void load(q)
        }}
      >
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو المهارة…"
          />
        </div>
        <button className="btn-primary" type="submit">
          بحث
        </button>
      </form>

      <div className="panel overflow-hidden">
        <ul className="divide-y divide-line">
          {profiles.map((item) => {
            const name =
              item.vmsProfile?.arName || item.vmsProfile?.enName || item.profile.membership_number
            const initials = String(name)
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p: string) => p[0])
              .join('')

            return (
              <li key={item.profile.membership_number}>
                <Link
                  to={`/talent/${item.profile.membership_number}`}
                  className="flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:px-5"
                >
                  {item.vmsProfile?.profilePictureUrl ? (
                    <img
                      src={item.vmsProfile.profilePictureUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-line"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-light text-xs font-bold text-brand-ink">
                      {initials || '؟'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="truncate font-semibold text-ink">{name}</h2>
                      <span className="text-xs font-medium text-brand">
                        {item.latestRole || 'بدون مسمى'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                      {item.profile.summary || 'لا توجد نبذة بعد.'}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
        {!profiles.length && (
          <p className="px-4 py-12 text-center text-sm text-muted">لا توجد سير منشورة بعد.</p>
        )}
      </div>
    </div>
  )
}
