import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Inbox, Lock, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { CvDocument } from '../components/CvDocument'
import { authDownloadHeaders, profilesApi } from '../services/api'

type PrivacyInfo = {
  mode?: 'full' | 'limited'
  accessStatus?: 'none' | 'pending' | 'accepted' | 'rejected' | 'revoked' | 'self'
  canRequestAccess?: boolean
  canDownloadDocuments?: boolean
}

function requestCountLabel(count: number) {
  if (count <= 0) return 'لا طلبات اطلاع بعد'
  if (count === 1) return 'طلب اطلاع واحد'
  if (count === 2) return 'طلبا اطلاع'
  if (count >= 3 && count <= 10) return `${count} طلبات اطلاع`
  return `${count} طلب اطلاع`
}

export default function TalentDetailPage() {
  const { membershipNumber = '' } = useParams()
  const [data, setData] = useState<any>(null)
  const [requesting, setRequesting] = useState(false)

  const load = async () => {
    if (!membershipNumber) return
    const payload = await profilesApi.getPublic(membershipNumber)
    setData(payload)
  }

  useEffect(() => {
    void load().catch((err) => toast.error(err?.response?.data?.message || 'السيرة غير متاحة'))
  }, [membershipNumber])

  const requestAccess = async () => {
    if (!membershipNumber || requesting) return
    setRequesting(true)
    try {
      await profilesApi.requestCvAccess(membershipNumber)
      toast.success('تم إرسال طلب الاطلاع')
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'تعذّر إرسال الطلب')
      if (err?.response?.status === 409) await load()
    } finally {
      setRequesting(false)
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="text-sm text-muted">جاري تحميل السيرة…</p>
      </div>
    )
  }

  const privacy = (data.privacy || {}) as PrivacyInfo
  const mode = privacy.mode === 'full' ? 'full' : 'limited'
  const status = privacy.accessStatus || 'none'
  const requestCount = Number(data.accessRequestCount || 0)
  const canRequest = Boolean(privacy.canRequestAccess)

  const limitedHint =
    status === 'pending'
      ? 'طلبك قيد الانتظار. الاسم والشركات تظهر بالأحرف الأولى فقط، ولا يمكن تنزيل الملفات.'
      : status === 'rejected'
        ? 'تم رفض طلبك سابقاً. لا يمكن إعادة إرسال الطلب.'
        : status === 'revoked'
          ? 'تم سحب صلاحيتك سابقاً. لا يمكن إعادة إرسال الطلب.'
          : 'الاسم والصورة وبيانات التواصل والشركات محمية. يمكنك طلب الاطلاع الكامل مرة واحدة فقط.'

  return (
    <div className="space-y-4">
      <Link
        to="/talent"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للسير العامة
      </Link>

      <div className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
        <Inbox className="h-4 w-4 text-slate-400" />
        <span className="font-semibold text-slate-800">{requestCountLabel(requestCount)}</span>
        <span className="text-xs text-slate-400">· إجمالي عام بدون تفاصيل</span>
      </div>

      {status !== 'self' ? (
        <div
          className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            mode === 'full'
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {mode === 'full' ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            )}
            <div>
              <p className="text-sm font-bold text-slate-800">
                {mode === 'full' ? 'لديك صلاحية الاطلاع الكامل' : 'عرض محدود للخصوصية'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {mode === 'full'
                  ? 'الاسم الكامل وبيانات التواصل والملفات متاحة لك.'
                  : limitedHint}
              </p>
            </div>
          </div>

          {mode === 'limited' ? (
            canRequest ? (
              <button
                type="button"
                className="btn-primary w-full shrink-0 sm:w-auto"
                disabled={requesting}
                onClick={() => void requestAccess()}
              >
                {requesting ? 'جارٍ الإرسال…' : 'طلب الاطلاع الكامل'}
              </button>
            ) : status === 'pending' ? (
              <span className="status-pill is-draft shrink-0">بانتظار الموافقة</span>
            ) : status === 'rejected' ? (
              <span className="status-pill shrink-0">مرفوض</span>
            ) : status === 'revoked' ? (
              <span className="status-pill shrink-0">مسحوب</span>
            ) : null
          ) : null}
        </div>
      ) : null}

      <CvDocument
        data={data}
        privacyMode={mode}
        onDownloadDocument={
          privacy.canDownloadDocuments
            ? (doc) =>
                void fetch(profilesApi.publicDocumentDownloadUrl(membershipNumber, doc.id), {
                  headers: authDownloadHeaders(),
                }).then(async (res) => {
                  if (!res.ok) {
                    toast.error(
                      res.status === 403 ? 'غير مصرح بتنزيل الملفات' : 'فشل التنزيل',
                    )
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
            : undefined
        }
      />
    </div>
  )
}
