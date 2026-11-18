import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { CvDocument } from '../components/CvDocument'
import { authDownloadHeaders, profilesApi } from '../services/api'

export default function TalentDetailPage() {
  const { membershipNumber = '' } = useParams()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!membershipNumber) return
    void profilesApi
      .getPublic(membershipNumber)
      .then(setData)
      .catch((err) => toast.error(err?.response?.data?.message || 'السيرة غير متاحة'))
  }, [membershipNumber])

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand" />
        <p className="text-slate-600">جاري تحميل السيرة…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        to="/talent"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للسير المنشورة
      </Link>

      <CvDocument
        data={data}
        onDownloadDocument={(doc) =>
          void fetch(profilesApi.publicDocumentDownloadUrl(membershipNumber, doc.id), {
            headers: authDownloadHeaders(),
          }).then(async (res) => {
            if (!res.ok) {
              toast.error('فشل التنزيل')
              return
            }
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
