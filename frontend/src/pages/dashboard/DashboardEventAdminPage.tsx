import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CheckCircle, Clock, Download, Search, Trash2, Users } from 'lucide-react'
import {
  approveRegistration,
  deleteEventRegistration,
  downloadEventRegistrationsCsv,
  fetchEventById,
  fetchEventRegistrations,
  fetchEventTickets,
  updateEventRegistration,
} from '../../api/vms'
import type { VmsEvent, VmsEventRegistration, VmsEventTicket } from '../../types/vms'
import { MemberInfoModal } from '../../components/dashboard/project-details/MemberInfoModal'
import { getStoredUser } from '../../utils/auth'
import { canManageVmsEvent } from '../../utils/event-access'

function registrationStatusLabel(status: string) {
  if (status === 'registered') return 'مسجل'
  if (status === 'attended') return 'حضر'
  if (status === 'cancelled') return 'ملغي'
  if (status === 'no_show') return 'لم يحضر'
  return status
}

const STATUS_FILTERS = [
  { value: '', label: 'كل الحالات' },
  { value: 'registered', label: 'مسجل' },
  { value: 'attended', label: 'حضر' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'no_show', label: 'لم يحضر' },
] as const

export function DashboardEventAdminPage() {
  const { eventID } = useParams()
  const user = useMemo(() => getStoredUser(), [])

  const [eventItem, setEventItem] = useState<VmsEvent | null>(null)
  const [tickets, setTickets] = useState<VmsEventTicket[]>([])
  const [registrations, setRegistrations] = useState<VmsEventRegistration[]>([])
  const [registrationsTotal, setRegistrationsTotal] = useState(0)
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({})
  const [hasMoreRegistrations, setHasMoreRegistrations] = useState(false)
  const [isLoadingMoreRegistrations, setIsLoadingMoreRegistrations] = useState(false)
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busyRegistrationId, setBusyRegistrationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [ticketFilter, setTicketFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [memberInfoTarget, setMemberInfoTarget] = useState<{
    membershipNumber: string
    displayName: string
  } | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const registrationQuery = useMemo(
    () => ({
      ticketId: ticketFilter || undefined,
      status: statusFilter || undefined,
      q: debouncedSearch || undefined,
    }),
    [debouncedSearch, statusFilter, ticketFilter],
  )

  useEffect(() => {
    if (!eventID) return
    const controller = new AbortController()
    async function load() {
      try {
        const [eventPayload, ticketsPayload] = await Promise.all([
          fetchEventById(eventID as string),
          fetchEventTickets(eventID as string),
        ])
        if (controller.signal.aborted) return
        setEventItem(eventPayload.event)
        setTickets(ticketsPayload.eventTickets)
      } catch {
        if (!controller.signal.aborted) setNotFound(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [eventID])

  useEffect(() => {
    if (!eventID) return
    const controller = new AbortController()
    async function loadRegistrations() {
      setIsLoadingRegistrations(true)
      try {
        const payload = await fetchEventRegistrations(eventID as string, registrationQuery)
        if (controller.signal.aborted) return
        setRegistrations(payload.eventRegistrations)
        setRegistrationsTotal(payload.total ?? payload.eventRegistrations.length)
        setHasMoreRegistrations(payload.hasMore ?? false)
        if (payload.ticketCounts) {
          setTicketCounts(payload.ticketCounts)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل التسجيلات.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingRegistrations(false)
      }
    }
    void loadRegistrations()
    return () => controller.abort()
  }, [eventID, registrationQuery])

  const canManageEvent = Boolean(user) && canManageVmsEvent(eventItem)

  const ticketMap = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets])
  const allRegistrationsCount = useMemo(
    () => Object.values(ticketCounts).reduce((sum, count) => sum + count, 0),
    [ticketCounts],
  )
  const hasActiveFilters = Boolean(ticketFilter || statusFilter || debouncedSearch)

  const handleStatus = async (registrationId: string, status: 'attended' | 'no_show' | 'cancelled') => {
    setError(null)
    setSuccess(null)
    setBusyRegistrationId(registrationId)
    try {
      const payload = await updateEventRegistration(registrationId, { status })
      const next = payload.eventRegistration
      const stillMatches = !statusFilter || next.status === statusFilter
      setRegistrations((previous) => {
        if (!stillMatches) {
          return previous.filter((item) => item.id !== registrationId)
        }
        return previous.map((item) => (item.id === registrationId ? next : item))
      })
      if (!stillMatches) {
        setRegistrationsTotal((previous) => Math.max(0, previous - 1))
      }
      setSuccess('تم تحديث حالة التسجيل بنجاح.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحديث الحالة.')
    } finally {
      setBusyRegistrationId(null)
    }
  }

  const handleApprove = async (registrationId: string, type: 'payment' | 'attendance') => {
    if (!user) return
    setError(null)
    setSuccess(null)
    setBusyRegistrationId(registrationId)
    try {
      const payload = await approveRegistration(registrationId, user.membershipNumber, type)
      setRegistrations((previous) => previous.map((item) => (item.id === registrationId ? payload.eventRegistration : item)))
      setSuccess(type === 'payment' ? 'تم اعتماد الدفع.' : 'تم اعتماد الحضور.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر اعتماد التسجيل.')
    } finally {
      setBusyRegistrationId(null)
    }
  }

  const handleDelete = async (registrationId: string) => {
    if (!window.confirm('هل تريد حذف هذا التسجيل؟')) return
    setError(null)
    setSuccess(null)
    setBusyRegistrationId(registrationId)
    try {
      await deleteEventRegistration(registrationId)
      setRegistrations((previous) => previous.filter((item) => item.id !== registrationId))
      setRegistrationsTotal((previous) => Math.max(0, previous - 1))
      setTicketCounts((previous) => {
        const registration = registrations.find((item) => item.id === registrationId)
        if (!registration) return previous
        const current = previous[registration.ticketId] ?? 0
        return { ...previous, [registration.ticketId]: Math.max(0, current - 1) }
      })
      setSuccess('تم حذف التسجيل.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر حذف التسجيل.')
    } finally {
      setBusyRegistrationId(null)
    }
  }

  const handleLoadMoreRegistrations = async () => {
    if (!eventID || isLoadingMoreRegistrations || !hasMoreRegistrations) {
      return
    }

    setIsLoadingMoreRegistrations(true)

    try {
      const payload = await fetchEventRegistrations(eventID, {
        ...registrationQuery,
        offset: registrations.length,
      })
      setRegistrations((previous) => [...previous, ...payload.eventRegistrations])
      setRegistrationsTotal(payload.total ?? registrationsTotal)
      setHasMoreRegistrations(payload.hasMore ?? false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل المزيد من التسجيلات.')
    } finally {
      setIsLoadingMoreRegistrations(false)
    }
  }

  const handleExport = async () => {
    if (!eventID) return
    setError(null)
    setIsExporting(true)
    try {
      await downloadEventRegistrationsCsv(eventID, {
        ...registrationQuery,
        filename: 'registrations.csv',
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تصدير التسجيلات.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!eventID || notFound) return <Navigate to="/events" replace />

  if (isLoading || !eventItem) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">جار تحميل صفحة إدارة التسجيلات...</p>
      </section>
    )
  }

  if (!canManageEvent) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-medium text-amber-900">لا تملك صلاحية إدارة تسجيلات هذه الفعالية.</p>
        <Link to={`/event/${eventID}`} className="mt-3 inline-flex text-sm font-semibold text-amber-800 underline">
          العودة إلى الفعالية
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">لوحة الإدارة</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{eventItem.name}</h1>
            <p className="mt-2 text-sm text-slate-600">إدارة جميع المسجلين وتحديث الحالات أو حذف التسجيل.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/event/${eventID}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              صفحة الفعالية
            </Link>
            <Link to={`/event/${eventID}/edit`} className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              تعديل الفعالية
            </Link>
          </div>
        </div>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <Users className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">المسجلون</h2>
          <span className="mr-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {registrationsTotal} تسجيل
          </span>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || registrationsTotal === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'جار التصدير...' : 'تصدير Excel'}
          </button>
        </div>

        <div className="mb-4 space-y-3">
          {tickets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTicketFilter('')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  ticketFilter === ''
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                كل التذاكر
                <span className="mr-1 opacity-80">({allRegistrationsCount || registrationsTotal})</span>
              </button>
              {tickets.map((ticket) => {
                const count = ticketCounts[ticket.id] ?? 0
                const selected = ticketFilter === ticket.id
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setTicketFilter(ticket.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'border-cyan-700 bg-cyan-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {ticket.name}
                    <span className="mr-1 opacity-80">({count})</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="بحث بالاسم أو البريد أو رقم العضوية أو الهاتف"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-10 pl-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingRegistrations ? <p className="text-sm text-slate-500">جار تصفية التسجيلات...</p> : null}

        {!isLoadingRegistrations && registrationsTotal === 0 ? (
          <p className="text-sm text-slate-500">
            {hasActiveFilters ? 'لا توجد نتائج مطابقة للبحث أو التصفية.' : 'لا توجد تسجيلات بعد.'}
          </p>
        ) : null}

        <ul className="space-y-2">
          {registrations.map((registration) => {
            const ticket = ticketMap.get(registration.ticketId)
            const busy = busyRegistrationId === registration.id
            const isGuest = !registration.membershipNumber
            const displayName =
              registration.displayName ??
              registration.guestName ??
              registration.membershipNumber ??
              registration.guestEmail ??
              'زائر'

            return (
              <li key={registration.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {isGuest ? (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{displayName}</p>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            زائر
                          </span>
                        </div>
                        {registration.guestEmail ? (
                          <p className="mt-0.5 text-xs text-slate-500">{registration.guestEmail}</p>
                        ) : null}
                        {registration.guestPhone ? (
                          <p className="mt-0.5 text-xs text-slate-500">{registration.guestPhone}</p>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setMemberInfoTarget({
                            membershipNumber: registration.membershipNumber as string,
                            displayName,
                          })
                        }
                        className="text-right transition hover:opacity-80"
                        title="عرض معلومات العضو"
                      >
                        <p className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                          {displayName}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{registration.membershipNumber}</p>
                      </button>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">التذكرة: {ticket ? ticket.name : 'غير معروفة'}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {registrationStatusLabel(registration.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!registration.paymentApprovedBy ? (
                    <button
                      type="button"
                      onClick={() => void handleApprove(registration.id, 'payment')}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle className="h-3 w-3" />
                      اعتماد الدفع
                    </button>
                  ) : null}
                  {!registration.attendanceApprovedBy ? (
                    <button
                      type="button"
                      onClick={() => void handleApprove(registration.id, 'attendance')}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle className="h-3 w-3" />
                      اعتماد الحضور
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleStatus(registration.id, 'attended')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="h-3 w-3" />
                    حضر
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStatus(registration.id, 'no_show')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Clock className="h-3 w-3" />
                    لم يحضر
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStatus(registration.id, 'cancelled')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(registration.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3 w-3" />
                    حذف التسجيل
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {hasMoreRegistrations ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void handleLoadMoreRegistrations()}
              disabled={isLoadingMoreRegistrations}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMoreRegistrations
                ? 'جار التحميل...'
                : `تحميل المزيد (${registrations.length} من ${registrationsTotal})`}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-medium text-emerald-700">{success}</p> : null}
      </article>

      {memberInfoTarget ? (
        <MemberInfoModal
          eventId={eventID}
          membershipNumber={memberInfoTarget.membershipNumber}
          displayName={memberInfoTarget.displayName}
          onClose={() => setMemberInfoTarget(null)}
        />
      ) : null}
    </section>
  )
}
