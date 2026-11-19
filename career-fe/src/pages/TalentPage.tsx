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
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">اكتشاف</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">السير المنشورة</h1>
        <p className="mt-2 text-sm text-slate-600">للمراجعة اليدوية من فريق إبتكار.</p>
      </div>

      <form
        className="mx-auto flex max-w-lg flex-wrap justify-center gap-2"
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

      <div className="grid gap-4 sm:grid-cols-2">
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
            <article
              key={item.profile.membership_number}
              className="group panel overflow-hidden transition hover:-translate-y-0.5 hover:border-teal-200"
            >
              <div className="h-1 bg-gradient-to-l from-brand to-accent opacity-80" />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  {item.vmsProfile?.profilePictureUrl ? (
                    <img
                      src={item.vmsProfile.profilePictureUrl}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover ring-2 ring-white shadow"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-light text-sm font-bold text-brand-ink">
                      {initials || '؟'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-900">{name}</h2>
                    <p className="truncate text-sm font-medium text-brand">
                      {item.latestRole || '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                  {item.profile.summary || 'لا توجد نبذة بعد.'}
                </p>
                <Link
                  className="mt-4 inline-flex text-sm font-semibold text-accent transition group-hover:text-accent-dark"
                  to={`/talent/${item.profile.membership_number}`}
                >
                  عرض السيرة ←
                </Link>
              </div>
            </article>
          )
        })}
      </div>
      {!profiles.length && (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 py-10 text-center text-slate-500">
          لا توجد سير منشورة بعد.
        </p>
      )}
    </div>
  )
}
