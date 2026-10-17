import { useCallback, useEffect, useMemo, useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import { createPositionApplication, fetchOpenPositions, selfCancelPositionApplication } from '../../api/vms'
import { VolunteeringCatalog } from '../../components/dashboard/volunteering/VolunteeringCatalog'
import type { VmsPosition } from '../../types/vms'
import { getStoredUser } from '../../utils/auth'

function VolunteeringSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <div key={`volunteering-skeleton-${key}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="h-20 animate-pulse bg-linear-to-br from-emerald-50 to-slate-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-full animate-pulse rounded-md bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded-md bg-slate-100" />
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardVolunteeringPage() {
  const user = useMemo(() => getStoredUser(), [])
  const [positions, setPositions] = useState<VmsPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [applyingPositionId, setApplyingPositionId] = useState<string | null>(null)
  const [cancellingPositionId, setCancellingPositionId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  const loadPositions = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      const payload = await fetchOpenPositions(user?.membershipNumber ?? '')
      setPositions(payload.positions)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [user?.membershipNumber])

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const payload = await fetchOpenPositions(user?.membershipNumber ?? '')

        if (!controller.signal.aborted) {
          setPositions(payload.positions)
          setHasError(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setHasError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [user?.membershipNumber])

  const appliedCount = useMemo(() => {
    if (!user?.membershipNumber) {
      return 0
    }

    return positions.filter((position) =>
      position.applications.some((application) => application.membershipNumber === user.membershipNumber),
    ).length
  }, [positions, user?.membershipNumber])

  const handleApply = async (positionId: string) => {
    if (!user) {
      setApplyError('يجب تسجيل الدخول أولاً.')
      return
    }

    setApplyError(null)
    setApplyingPositionId(positionId)

    try {
      const { positionApplication } = await createPositionApplication(positionId, {}, user.membershipNumber)
      setPositions((previous) =>
        previous.map((position) =>
          position.id === positionId
            ? {
                ...position,
                applications: [...position.applications, positionApplication],
              }
            : position,
        ),
      )
    } catch (requestError) {
      if (requestError instanceof Error) {
        setApplyError(requestError.message)
      } else {
        setApplyError('تعذر التقديم على الفرصة.')
      }
    } finally {
      setApplyingPositionId(null)
    }
  }

  const handleCancel = async (positionId: string, applicationId: string) => {
    if (!user) {
      setApplyError('يجب تسجيل الدخول أولاً.')
      return
    }

    setApplyError(null)
    setCancellingPositionId(positionId)

    try {
      await selfCancelPositionApplication(applicationId)
      setPositions((previous) =>
        previous.map((position) =>
          position.id === positionId
            ? {
                ...position,
                applications: position.applications.filter((application) => application.id !== applicationId),
              }
            : position,
        ),
      )
    } catch (requestError) {
      if (requestError instanceof Error) {
        setApplyError(requestError.message)
      } else {
        setApplyError('تعذر إلغاء طلب التطوع.')
      }
    } finally {
      setCancellingPositionId(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <HeartHandshake className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">التطوع</h2>
            <p className="mt-1 text-sm text-slate-500">الفرص التطوعية المفتوحة عبر جميع المشاريع.</p>
            <p className="mt-1 text-xs text-slate-500">تصفّح الفرص، تابع طلباتك، وقدّم مباشرة من هذه الصفحة.</p>
          </div>
        </div>

        {!isLoading && !hasError ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              {positions.length} فرصة مفتوحة
            </span>
            {appliedCount > 0 ? (
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {appliedCount} طلب مقدّم
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {applyError ? (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2 text-sm text-red-700">{applyError}</div>
      ) : null}

      {isLoading ? <VolunteeringSkeleton /> : null}

      {hasError ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-5 text-center">
          <p className="text-sm font-medium text-red-800">تعذر تحميل الفرص التطوعية.</p>
          <p className="mt-1 text-xs text-red-700/90">تحقق من الاتصال ثم أعد المحاولة.</p>
          <button
            type="button"
            onClick={() => void loadPositions()}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {!isLoading && !hasError ? (
        <VolunteeringCatalog
          positions={positions}
          membershipNumber={user?.membershipNumber}
          applyingPositionId={applyingPositionId}
          cancellingPositionId={cancellingPositionId}
          onApply={(positionId) => void handleApply(positionId)}
          onCancel={(positionId, applicationId) => void handleCancel(positionId, applicationId)}
          emptyMessage="لا توجد فرص تطوعية مفتوحة حالياً."
        />
      ) : null}
    </section>
  )
}
