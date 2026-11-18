import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
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
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-rich-gold" />
        <p>جاري التحميل…</p>
      </div>
    )
  }

  const vms = data.vmsProfile
  return (
    <div className="space-y-6 px-2 sm:px-0">
      <section className="panel p-6 sm:p-8">
        <div className="flex items-center gap-4">
          {vms?.profilePictureUrl ? (
            <img src={vms.profilePictureUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
          ) : null}
          <div>
            <h1 className="text-3xl font-bold text-carbon">
              {vms?.arName || vms?.enName || membershipNumber}
            </h1>
            <p className="text-rich-gold">{data.profile.headline}</p>
            <p className="text-sm text-gray-600">
              {[vms?.educationLevel, vms?.fieldOfStudy, vms?.school].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-gray-700">{data.profile.summary}</p>
        <p className="mt-3 text-sm text-gray-600">المهارات: {vms?.skills || '—'}</p>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="section-title">الخبرات العملية</h2>
        <ul className="space-y-3">
          {data.workExperiences?.map((item: any) => (
            <li key={item.id} className="rounded-xl border border-gray-200 p-4">
              <p className="font-semibold">
                {item.title} · {item.company_name}
              </p>
              <p className="text-sm text-gray-500">
                {item.start_date || '؟'} — {item.is_current ? 'حالياً' : item.end_date || '؟'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {item.responsibilities || item.description}
              </p>
              {!!item.skills?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.skills.map((skill: any) => (
                    <span key={skill.skillId || skill.name} className="chip">
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {!data.workExperiences?.length && <p className="text-gray-500">لا توجد خبرات مسجّلة.</p>}
        </ul>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="section-title">المشاريع</h2>
        <ul className="space-y-3">
          {data.projects?.map((item: any) => (
            <li key={item.id} className="rounded-xl border border-gray-200 p-4">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-gray-500">{[item.role, item.company].filter(Boolean).join(' · ')}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.responsibilities}</p>
              {!!item.skills?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.skills.map((skill: any) => (
                    <span key={skill.skillId || skill.name} className="chip">
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {!data.projects?.length && <p className="text-gray-500">لا توجد مشاريع مسجّلة.</p>}
        </ul>
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="section-title">الملفات</h2>
        <ul className="space-y-2">
          {data.documents?.map((doc: any) => (
            <li key={doc.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="font-semibold">{doc.file_name}</p>
                <p className="text-xs text-gray-500">{doc.kind === 'cv' ? 'سيرة ذاتية' : 'ملف أعمال'}</p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
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
              >
                تنزيل
              </button>
            </li>
          ))}
          {!data.documents?.length && <p className="text-gray-500">لا توجد ملفات مرفوعة.</p>}
        </ul>
      </section>
    </div>
  )
}
