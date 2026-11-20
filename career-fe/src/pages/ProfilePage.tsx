import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { CvDocument } from '../components/CvDocument'
import { displayNameOf } from '../lib/profile-utils'
import { authDownloadHeaders, profilesApi } from '../services/api'

export default function ProfilePage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    void profilesApi
      .me()
      .then(setData)
      .catch(() => toast.error('تعذّر تحميل السيرة'))
  }, [])

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="text-sm text-muted">جاري تحميل بيانات سيرتك…</p>
      </div>
    )
  }

  const displayName = displayNameOf(data)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">سيرتي</p>
          <h1 className="page-title">{displayName}</h1>
          <p className="page-desc">معاينة سيرتك المهنية كما تظهر للمراجعة.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`status-pill ${data.profile.is_published ? 'is-live' : 'is-draft'}`}>
            {data.profile.is_published ? 'منشورة' : 'مسودة'}
          </span>
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
