import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { CvDocument } from '../components/CvDocument'
import { displayNameOf } from '../lib/profile-utils'
import { authDownloadHeaders, profilesApi } from '../services/api'

export default function ProfilePage() {
  const [data, setData] = useState<any>(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    void profilesApi
      .me()
      .then(setData)
      .catch(() => toast.error('تعذّر تحميل السيرة'))
  }, [])

  const setPublic = async (next: boolean) => {
    if (!data || publishing) return
    const previous = Boolean(data.profile?.is_published)
    setPublishing(true)
    setData((prev: any) =>
      prev
        ? {
            ...prev,
            profile: { ...prev.profile, is_published: next },
          }
        : prev,
    )
    try {
      await profilesApi.updateMe({ is_published: next })
      toast.success(next ? 'أصبحت السيرة عامة' : 'أصبحت السيرة خاصة')
    } catch {
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              profile: { ...prev.profile, is_published: previous },
            }
          : prev,
      )
      toast.error('تعذّر تحديث حالة السيرة')
    } finally {
      setPublishing(false)
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="text-sm text-muted">جاري تحميل بيانات سيرتك…</p>
      </div>
    )
  }

  const displayName = displayNameOf(data)
  const isPublic = Boolean(data.profile.is_published)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">سيرتي</p>
          <h1 className="page-title">{displayName}</h1>
          <p className="page-desc">
            معاينة سيرتك المهنية. السيرة خاصة افتراضياً حتى تفعّل الظهور العام.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 ${
              publishing ? 'opacity-60' : ''
            }`}
          >
            <span className="text-sm font-semibold text-slate-700">
              {isPublic ? 'سيرة عامة' : 'سيرة خاصة'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              aria-label={isPublic ? 'جعل السيرة خاصة' : 'جعل السيرة عامة'}
              disabled={publishing}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isPublic ? 'bg-brand' : 'bg-slate-300'
              }`}
              onClick={() => void setPublic(!isPublic)}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] ${
                  isPublic ? 'start-[1.375rem]' : 'start-0.5'
                }`}
              />
            </button>
          </div>
          <Link to="/profile/access" className="btn-ghost">
            <Shield className="h-4 w-4" />
            طلبات الوصول
          </Link>
          <Link to="/profile/edit" className="btn-primary">
            <Pencil className="h-4 w-4" />
            تعديل السيرة
          </Link>
        </div>
      </div>

      <CvDocument
        data={data}
        onDownloadDocument={(doc) =>
          void fetch(profilesApi.documentDownloadUrl(doc.id), {
            headers: authDownloadHeaders(),
          }).then(async (res) => {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = doc.file_name
            a.click()
            URL.revokeObjectURL(url)
          })
        }
      />
    </div>
  )
}
