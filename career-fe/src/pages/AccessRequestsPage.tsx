import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Shield, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { profilesApi } from '../services/api'

type Requester = {
  membershipNumber: string
  enName?: string | null
  arName?: string | null
  email?: string | null
  profilePictureUrl?: string | null
  sex?: string | null
  country?: string | null
  city?: string | null
}

type AccessItem = {
  id: string
  status: string
  message?: string | null
  created_at: string
  updated_at: string
  requester: Requester
}

function displayRequester(item: AccessItem) {
  return (
    item.requester.arName ||
    item.requester.enName ||
    item.requester.membershipNumber
  )
}

function formatWhen(value?: string | null) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('ar', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function PersonCard({
  item,
  actions,
}: {
  item: AccessItem
  actions?: ReactNode
}) {
  const name = displayRequester(item)
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] || '')
    .join('')

  return (
    <li className="flex flex-col gap-3 border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {item.requester.profilePictureUrl ? (
          <img
            src={item.requester.profilePictureUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-line"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-light text-xs font-bold text-brand-ink">
            {initials || '؟'}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
            {item.requester.membershipNumber}
            {item.requester.email ? ` · ${item.requester.email}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {[item.requester.city, item.requester.country].filter(Boolean).join(' · ') ||
              'عضو في منصة الأعضاء'}
            {' · '}
            {formatWhen(item.updated_at || item.created_at)}
          </p>
          {item.message ? (
            <p className="mt-1 text-sm text-slate-600">{item.message}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </li>
  )
}

export default function AccessRequestsPage() {
  const [pending, setPending] = useState<AccessItem[]>([])
  const [accepted, setAccepted] = useState<AccessItem[]>([])
  const [rejected, setRejected] = useState<AccessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const data = await profilesApi.listAccessRequests()
    setPending(data.pending || [])
    setAccepted(data.accepted || [])
    setRejected(data.rejected || [])
  }

  useEffect(() => {
    void load()
      .catch(() => toast.error('تعذّر تحميل طلبات الوصول'))
      .finally(() => setLoading(false))
  }, [])

  const decide = async (id: string, status: 'accepted' | 'rejected' | 'revoked') => {
    setBusyId(id)
    try {
      await profilesApi.decideAccessRequest(id, status)
      toast.success(
        status === 'accepted'
          ? 'تم منح الوصول'
          : status === 'revoked'
            ? 'تم سحب الوصول'
            : 'تم رفض الطلب',
      )
      await load()
    } catch {
      toast.error('تعذّر تحديث الطلب')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="text-sm text-muted">جاري تحميل طلبات الوصول…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-line pb-5">
        <p className="page-kicker">الخصوصية</p>
        <h1 className="page-title">طلبات الاطلاع على السيرة</h1>
        <p className="page-desc">
          راجع من طلب رؤية بياناتك الكاملة، وامنح أو اسحب الصلاحية في أي وقت. كل طلب يُحفظ مرة
          واحدة ولا يُعاد إرساله، ويظهر إجمالي عدد الطلبات علناً على سيرتك دون كشف التفاصيل.
        </p>
        <Link to="/profile" className="mt-3 inline-flex text-sm font-semibold text-brand">
          العودة لسيرتي
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-800">طلبات معلّقة ({pending.length})</h2>
        </div>
        {!pending.length ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-slate-400">
            لا توجد طلبات معلّقة حالياً.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => (
              <PersonCard
                key={item.id}
                item={item}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn-primary flex-1 py-2 text-xs sm:flex-none sm:py-1.5"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item.id, 'accepted')}
                    >
                      <Check className="h-3.5 w-3.5" />
                      قبول
                    </button>
                    <button
                      type="button"
                      className="btn-danger flex-1 py-2 text-xs sm:flex-none sm:py-1.5"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item.id, 'rejected')}
                    >
                      <X className="h-3.5 w-3.5" />
                      رفض
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800">
          أشخاص لديهم وصول كامل ({accepted.length})
        </h2>
        {!accepted.length ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-slate-400">
            لم تمنح صلاحية كاملة لأي عضو بعد.
          </p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((item) => (
              <PersonCard
                key={item.id}
                item={item}
                actions={
                  <button
                    type="button"
                    className="btn-danger py-1.5 text-xs"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, 'revoked')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    سحب الوصول
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {rejected.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800">مرفوض / مسحوب ({rejected.length})</h2>
          <ul className="space-y-2">
            {rejected.map((item) => (
              <PersonCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
