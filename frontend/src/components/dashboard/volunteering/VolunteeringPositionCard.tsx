import { Briefcase, CheckCircle2, Clock3, Users, XCircle } from 'lucide-react'
import type { VmsPosition, VmsPositionApplication } from '../../../types/vms'

function applicationStatusLabel(status: string) {
  if (status === 'pending') return 'قيد المراجعة'
  if (status === 'accepted') return 'مقبول'
  if (status === 'rejected') return 'مرفوض'
  return status
}

function applicationStatusClass(status: string) {
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function ApplicationStatusIcon({ status }: { status: string }) {
  if (status === 'accepted') return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
  if (status === 'rejected') return <XCircle className="h-3.5 w-3.5" aria-hidden />
  return <Clock3 className="h-3.5 w-3.5" aria-hidden />
}

export function VolunteeringPositionCard({
  position,
  userApplication,
  isApplying,
  isCancelling,
  onApply,
  onCancel,
}: {
  position: VmsPosition
  userApplication: VmsPositionApplication | null
  isApplying: boolean
  isCancelling: boolean
  onApply: () => void
  onCancel: () => void
}) {
  const seatsFilledPercent =
    position.seats > 0 ? Math.min(100, Math.round((position.acceptedApplicationsCount / position.seats) * 100)) : 0
  const remainingSeats = Math.max(0, position.seats - position.acceptedApplicationsCount)
  const hasApplied = Boolean(userApplication)

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="relative flex items-center gap-3 border-b border-emerald-100/80 bg-linear-to-br from-emerald-50 via-teal-50 to-white px-4 py-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-white text-emerald-700 shadow-xs">
          <Briefcase className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-emerald-700/90">
            {position.projectName ?? position.projectId}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{position.name}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-200 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          مفتوحة
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {position.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{position.description}</p>
        ) : (
          <p className="text-sm text-slate-400">لا يوجد وصف لهذه الفرصة.</p>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {position.acceptedApplicationsCount} من {position.seats} مقاعد
            </span>
            <span className="text-slate-500">{remainingSeats} متبقٍ</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-all duration-300"
              style={{ width: `${seatsFilledPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {position.applications.length} طلب
          </span>
          {position.createdByDisplayName ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
              بواسطة {position.createdByDisplayName}
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          {hasApplied && userApplication ? (
            <div className="space-y-3">
              <span
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${applicationStatusClass(userApplication.status)}`}
              >
                <ApplicationStatusIcon status={userApplication.status} />
                {applicationStatusLabel(userApplication.status)}
              </span>
              {userApplication.status === 'pending' ? (
                <>
                  <p className="text-center text-[11px] leading-relaxed text-slate-500">
                    تم استلام طلبك. سيتم إعلامك عند مراجعته.
                  </p>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isCancelling ? 'جارٍ الإلغاء...' : 'إلغاء الطلب'}
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying || remainingSeats === 0}
              className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-300 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-emerald-400 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isApplying ? 'جار التقديم...' : remainingSeats === 0 ? 'المقاعد مكتملة' : 'تقديم على الفرصة'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
