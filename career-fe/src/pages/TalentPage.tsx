import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <div className="space-y-6 px-2 sm:px-0">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-carbon">السير المنشورة</h1>
        <p className="mt-2 text-gray-700">للمراجعة اليدوية من فريق إبتكار.</p>
      </div>

      <form
        className="flex flex-wrap justify-center gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void load(q)
        }}
      >
        <input className="field max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" />
        <button className="btn-primary" type="submit">
          بحث
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((item) => (
          <article key={item.profile.membership_number} className="panel p-5">
            <div className="flex items-center gap-3">
              {item.vmsProfile?.profilePictureUrl ? (
                <img
                  src={item.vmsProfile.profilePictureUrl}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-sand text-xs text-gray-500">
                  بلا صورة
                </div>
              )}
              <div>
                <h2 className="font-semibold">
                  {item.vmsProfile?.arName || item.vmsProfile?.enName || item.profile.membership_number}
                </h2>
                <p className="text-sm text-rich-gold">{item.profile.headline || 'بدون مسمى'}</p>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-gray-700">{item.profile.summary}</p>
            <Link
              className="mt-3 inline-block text-sm font-semibold text-deep-green"
              to={`/talent/${item.profile.membership_number}`}
            >
              عرض السيرة
            </Link>
          </article>
        ))}
      </div>
      {!profiles.length && <p className="text-center text-gray-500">لا توجد سير منشورة بعد.</p>}
    </div>
  )
}
