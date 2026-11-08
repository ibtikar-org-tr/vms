import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Download, Mail, Megaphone, Search, Send, Users } from 'lucide-react'
import {
  continueAssemblyAnnouncement,
  createAssemblyAnnouncement,
  downloadAssemblyMembersCsv,
  fetchAssemblyAccess,
  fetchAssemblyAnnouncement,
  fetchAssemblyAnnouncements,
  fetchAssemblyMembers,
} from '../../api/vms'
import type { AssemblyAnnouncement, AssemblyAnnouncementFailure, AssemblyMember } from '../../types/vms'
import { getStoredUser, isPlatformAdmin } from '../../utils/auth'

type TabKey = 'members' | 'broadcast'

function announcementStatusLabel(status: AssemblyAnnouncement['status']) {
  if (status === 'sent') return 'أُرسلت'
  if (status === 'partial') return 'أُرسلت جزئياً'
  if (status === 'sending' || status === 'queued') return 'جارٍ الإرسال'
  return 'فشلت'
}

function announcementDone(status: AssemblyAnnouncement['status']) {
  return status === 'sent' || status === 'partial' || status === 'failed'
}

function announcementProgress(item: AssemblyAnnouncement) {
  const telegramTotal = item.sendTelegram ? item.telegramTotal : 0
  const emailTotal = item.sendEmail ? item.emailTotal : 0
  const total = telegramTotal + emailTotal
  const done =
    (item.sendTelegram ? item.telegramSent + item.telegramFailed : 0) +
    (item.sendEmail ? item.emailSent + item.emailFailed : 0)
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : item.status === 'queued' ? 2 : 0
  return { total, done, percent }
}

function channelLabel(channel: AssemblyAnnouncementFailure['channel']) {
  return channel === 'telegram' ? 'تيليغرام' : 'بريد'
}

function downloadFailuresCsv(failures: AssemblyAnnouncementFailure[]) {
  const header = ['القناة', 'رقم العضوية', 'الاسم', 'البريد', 'السبب']
  const rows = failures.map((item) =>
    [channelLabel(item.channel), item.membershipNumber ?? '', item.displayName ?? '', item.email ?? '', item.error ?? '']
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = `\uFEFF${[header.join(','), ...rows].join('\n')}`
  const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = 'assembly-announcement-failures.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function DashboardAssemblyPage() {
  const user = useMemo(() => getStoredUser(), [])
  const [isLeadership, setIsLeadership] = useState(isPlatformAdmin(user))
  const [accessChecked, setAccessChecked] = useState(isPlatformAdmin(user))
  const [tab, setTab] = useState<TabKey>('members')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [volunteersOnly, setVolunteersOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [members, setMembers] = useState<AssemblyMember[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ totalMembers: 0, telegramLinked: 0, volunteers: 0 })
  const [isLoadingMembers, setIsLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendTelegram, setSendTelegram] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [announcements, setAnnouncements] = useState<AssemblyAnnouncement[]>([])
  const [progress, setProgress] = useState<AssemblyAnnouncement | null>(null)
  const [failures, setFailures] = useState<AssemblyAnnouncementFailure[]>([])
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const pageSize = 40
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    let cancelled = false
    void fetchAssemblyAccess()
      .then((payload) => {
        if (!cancelled) {
          setIsLeadership(payload.isAssemblyLeadership)
          setAccessChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) setAccessChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true)
    setMembersError(null)
    try {
      const payload = await fetchAssemblyMembers({
        q: debouncedQuery,
        volunteersOnly,
        page,
        pageSize,
      })
      setMembers(payload.members)
      setTotal(payload.total)
      setCounts(payload.counts)
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : 'تعذر تحميل الأعضاء.')
    } finally {
      setIsLoadingMembers(false)
    }
  }, [debouncedQuery, page, volunteersOnly])

  useEffect(() => {
    if (!isLeadership) return
    void loadMembers()
  }, [isLeadership, loadMembers])

  const loadAnnouncements = useCallback(async () => {
    try {
      const payload = await fetchAssemblyAnnouncements()
      setAnnouncements(payload.announcements)
    } catch {
      setAnnouncements([])
    }
  }, [])

  useEffect(() => {
    if (isLeadership && tab === 'broadcast') {
      void loadAnnouncements()
    }
  }, [isLeadership, loadAnnouncements, tab])

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1800)
  }

  async function pumpAnnouncement(start: AssemblyAnnouncement, startNeedsContinue: boolean) {
    let announcement = start
    let needsContinue = startNeedsContinue
    setProgress(announcement)

    while (needsContinue && announcement?.id) {
      let next: { announcement: AssemblyAnnouncement; queued?: boolean; needsContinue: boolean } | null = null
      let lastError: unknown = null

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 + attempt * 250))
        try {
          next = await continueAssemblyAnnouncement(announcement.id)
          lastError = null
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!next) {
        throw lastError instanceof Error ? lastError : new Error('تعذر متابعة الإرسال. يمكنك الضغط على متابعة الإرسال.')
      }

      announcement = next.announcement
      needsContinue = Boolean(next.queued) ? false : next.needsContinue
      setProgress(announcement)
      if (next.queued) {
        setWatchingId(announcement.id)
        break
      }
    }

    return announcement
  }

  useEffect(() => {
    if (!watchingId) return

    let cancelled = false

    async function tick(id: string) {
      try {
        const detail = await fetchAssemblyAnnouncement(id)
        if (cancelled) return
        setProgress(detail.announcement)
        setFailures(detail.failures)
        if (announcementDone(detail.announcement.status)) {
          setWatchingId(null)
          setIsSending(false)
          if (detail.announcement.status === 'failed') {
            setSendError(detail.announcement.lastError || 'تعذر إرسال الرسالة.')
          } else {
            setSendSuccess(
              `تم الإرسال. تيليغرام: ${detail.announcement.telegramSent} · بريد: ${detail.announcement.emailSent}${
                detail.announcement.status === 'partial' ? ' · راجع من تعذر الوصول إليهم بالأسفل' : ''
              }`,
            )
            if (detail.announcement.status === 'sent') {
              setSubject('')
              setBody('')
              setConfirmed(false)
            }
          }
          await loadAnnouncements()
        }
      } catch {
        // Keep polling; a single failed status request should not stop the queue.
      }
    }

    void tick(watchingId)
    const handle = window.setInterval(() => void tick(watchingId), 1500)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [loadAnnouncements, watchingId])

  async function handleExport() {
    setIsExporting(true)
    try {
      await downloadAssemblyMembersCsv({ q: debouncedQuery, volunteersOnly })
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : 'تعذر التصدير.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleSend() {
    setSendError(null)
    setSendSuccess(null)
    if (!subject.trim() || !body.trim()) {
      setSendError('أدخل عنوان الرسالة ونصها.')
      return
    }
    if (!sendEmail && !sendTelegram) {
      setSendError('اختر تيليغرام أو البريد أو كليهما.')
      return
    }
    if (!confirmed) {
      setSendError('أكّد الإرسال لجميع الأعضاء أولاً.')
      return
    }

    setIsSending(true)
    setFailures([])
    try {
      const created = await createAssemblyAnnouncement({
        subject: subject.trim(),
        body: body.trim(),
        sendEmail,
        sendTelegram,
      })
      let announcement = created.announcement
      setProgress(announcement)
      await loadAnnouncements()

      if (created.queued || created.needsContinue) {
        setWatchingId(announcement.id)
      }

      if (!created.queued && created.needsContinue) {
        announcement = await pumpAnnouncement(announcement, created.needsContinue)
      }

      if (!announcementDone(announcement.status)) {
        return
      }

      setWatchingId(null)
      const detail = await fetchAssemblyAnnouncement(announcement.id).catch(() => null)
      if (detail) {
        setProgress(detail.announcement)
        setFailures(detail.failures)
        announcement = detail.announcement
      }
      if (announcement.status === 'failed') {
        setSendError(announcement.lastError || 'تعذر إرسال الرسالة.')
      } else {
        setSendSuccess(
          `تم الإرسال. تيليغرام: ${announcement.telegramSent} · بريد: ${announcement.emailSent}${
            announcement.status === 'partial' ? ' · راجع من تعذر الوصول إليهم بالأسفل' : ''
          }`,
        )
        if (announcement.status === 'sent') {
          setSubject('')
          setBody('')
          setConfirmed(false)
        }
      }
      setIsSending(false)
    } catch (error) {
      setSendError(
        error instanceof Error
          ? `${error.message} إن توقف الإرسال، اضغط «متابعة الإرسال» من الرسائل السابقة.`
          : 'تعذر إرسال الرسالة. يمكنك الضغط على متابعة الإرسال.',
      )
      await loadAnnouncements()
      setIsSending(false)
    }
  }

  async function resumeAnnouncement(item: AssemblyAnnouncement) {
    setIsSending(true)
    setSendError(null)
    setSendSuccess(null)
    setProgress(item)
    setWatchingId(item.id)
    try {
      const next = await continueAssemblyAnnouncement(item.id)
      setProgress(next.announcement)
      if (!next.queued && next.needsContinue) {
        await pumpAnnouncement(next.announcement, next.needsContinue)
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'تعذر متابعة الإرسال.')
      setIsSending(false)
    }
  }

  if (!accessChecked) {
    return <p className="p-6 text-center text-sm text-slate-500">جار التحقق من الصلاحيات...</p>
  }

  if (!isLeadership) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">إدارة التجمّع</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          هذه الصفحة متاحة لرئيس مجلس الإدارة ومدير المنصة. لقب «رئيس مجلس الإدارة» يظهر إذا كنت مالكاً أو مديراً لمشروع مجلس الإدارة،
          لكنه لا يفتح بيانات كل الأعضاء تلقائياً إلا من هنا بعد تفعيل الصلاحية.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">إدارة التجمّع</h2>
          <p className="mt-1 text-sm leading-7 text-slate-500">
            دليل كل من انتسب إلى تجمّع إبتكار، مع بيانات التواصل والتطوع، وإرسال رسالة موحّدة عبر تيليغرام والبريد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
            {counts.totalMembers} عضو
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            {counts.volunteers} مهتم بالتطوع
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            {counts.telegramLinked} تيليغرام
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('members')}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-semibold ${
            tab === 'members' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          الأعضاء والمتطوعون
        </button>
        <button
          type="button"
          onClick={() => setTab('broadcast')}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-semibold ${
            tab === 'broadcast' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          رسالة جماعية
        </button>
      </div>

      {tab === 'members' ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="ابحث بالاسم أو رقم العضوية أو البريد أو الهاتف"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-cyan-600"
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={volunteersOnly}
                onChange={(event) => {
                  setVolunteersOnly(event.target.checked)
                  setPage(1)
                }}
              />
              المهتمون بالتطوع فقط
            </label>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'جار التصدير...' : 'تصدير CSV'}
            </button>
          </div>

          {membersError ? <p className="text-sm text-red-600">{membersError}</p> : null}
          {isLoadingMembers ? <p className="text-sm text-slate-500">جار تحميل الأعضاء...</p> : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">العضو</th>
                  <th className="px-3 py-2">التواصل</th>
                  <th className="px-3 py-2">التطوع</th>
                  <th className="px-3 py-2">المشاريع</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const open = expandedId === member.membershipNumber
                  return (
                    <tr key={member.membershipNumber} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : member.membershipNumber)}
                          className="text-right"
                        >
                          <p className="font-semibold text-slate-900">{member.displayName}</p>
                          <p className="text-xs text-slate-500">{member.membershipNumber}</p>
                          {member.enName ? <p className="text-xs text-slate-400">{member.enName}</p> : null}
                        </button>
                        {open ? (
                          <div className="mt-2 space-y-1 text-xs leading-6 text-slate-600">
                            <p>الجنس: {member.sex === 'female' ? 'أنثى' : member.sex === 'male' ? 'ذكر' : '—'}</p>
                            <p>
                              الموقع: {[member.city, member.region, member.country].filter(Boolean).join(' · ') || '—'}
                            </p>
                            <p>الجامعة: {member.school || '—'}</p>
                            <p>التخصص: {member.fieldOfStudy || '—'}</p>
                            <p>تاريخ الانتساب: {member.createdAt.slice(0, 10)}</p>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs leading-6 text-slate-700">
                        <p>{member.email}</p>
                        <p>{member.phoneNumber || '—'}</p>
                        <p>{member.telegramUsername ? `@${member.telegramUsername.replace(/^@/, '')}` : 'بدون تيليغرام'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            member.isVolunteer ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {member.volunteeringLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs leading-6 text-slate-600">
                        {member.projects.length > 0 ? member.projects.join('، ') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600">
            <p>
              صفحة {page} من {totalPages} · {total} نتيجة
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                السابق
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSend()
            }}
          >
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">عنوان الرسالة</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={160}
                placeholder="مثال: دعوة لحضور اجتماع التجمّع"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">نص الرسالة</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
                maxLength={8000}
                placeholder="اكتب الرسالة بالعربية. ستُرسل بتوقيع مجلس الإدارة وقالب تجمّع إبتكار."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-7 outline-none focus:border-cyan-600"
              />
            </label>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={sendTelegram} onChange={(event) => setSendTelegram(event.target.checked)} />
                تيليغرام
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
                البريد الإلكتروني
              </label>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              أؤكد إرسال هذه الرسالة لكل أعضاء التجمّع على القنوات المختارة.
            </label>
            {sendError ? <p className="text-sm text-red-600">{sendError}</p> : null}
            {sendSuccess ? <p className="text-sm text-emerald-700">{sendSuccess}</p> : null}
            {progress ? (
              <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold text-cyan-950">
                    {announcementDone(progress.status) ? announcementStatusLabel(progress.status) : 'جارٍ الإرسال في الخلفية'}
                  </p>
                  <p className="text-xs text-cyan-800">{announcementProgress(progress).percent}%</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cyan-100">
                  <div
                    className="h-full rounded-full bg-cyan-700 transition-all"
                    style={{ width: `${announcementProgress(progress).percent}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <p>
                    تيليغرام: {progress.telegramSent} نجح · {progress.telegramFailed} فشل
                    {progress.telegramTotal ? ` من ${progress.telegramTotal}` : ''}
                  </p>
                  <p>
                    بريد: {progress.emailSent} نجح · {progress.emailFailed} فشل
                    {progress.emailTotal ? ` من ${progress.emailTotal}` : ''}
                  </p>
                </div>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-400"
            >
              <Send className="h-4 w-4" />
              {isSending ? 'جارٍ الإرسال...' : 'إرسال للجميع'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-linear-to-l from-cyan-800 to-teal-700 px-5 py-4 text-white">
                <p className="text-[11px] font-bold tracking-wide text-cyan-100">تجمّع إبتكار</p>
                <h3 className="mt-1 text-lg font-extrabold">{subject.trim() || 'عنوان الرسالة'}</h3>
                <p className="mt-1 text-xs text-cyan-100">رسالة من مجلس الإدارة إلى أعضاء التجمّع</p>
              </div>
              <div className="space-y-3 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                <p>السلام عليكم عضو تجمّع إبتكار،</p>
                <p className="whitespace-pre-wrap">{body.trim() || 'سيظهر نص الرسالة هنا مع التوقيع.'}</p>
                <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
                  <p className="font-extrabold text-teal-700">مجلس الإدارة</p>
                  <p className="font-semibold text-slate-700">تجمّع إبتكار</p>
                  <p>vms.ibtikar.tr</p>
                </div>
              </div>
            </div>
            {failures.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-red-950">تعذر الوصول إلى {failures.length} عضو</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          'emails',
                          failures
                            .map((item) => item.email)
                            .filter((value): value is string => Boolean(value))
                            .join('\n'),
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === 'emails' ? 'تم النسخ' : 'نسخ البريد'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          'numbers',
                          failures
                            .map((item) => item.membershipNumber)
                            .filter((value): value is string => Boolean(value))
                            .join('\n'),
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === 'numbers' ? 'تم النسخ' : 'نسخ الأرقام'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFailuresCsv(failures)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline"
                    >
                      <Download className="h-3 w-3" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-red-100 bg-white">
                  <table className="min-w-full text-right text-xs">
                    <thead className="bg-red-50 text-red-900">
                      <tr>
                        <th className="px-2 py-1.5">العضو</th>
                        <th className="px-2 py-1.5">القناة</th>
                        <th className="px-2 py-1.5">السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failures.map((item) => (
                        <tr key={item.id} className="border-t border-red-50">
                          <td className="px-2 py-1.5">
                            <p className="font-semibold text-slate-900">{item.displayName || item.membershipNumber}</p>
                            <p className="text-slate-500">{item.membershipNumber}</p>
                            {item.email ? <p className="text-slate-500">{item.email}</p> : null}
                          </td>
                          <td className="px-2 py-1.5 text-slate-700">{channelLabel(item.channel)}</td>
                          <td className="px-2 py-1.5 text-slate-600">{item.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Mail className="h-4 w-4" />
                الرسائل السابقة
              </p>
              <div className="mt-3 space-y-2">
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد رسائل بعد.</p>
                ) : (
                  announcements.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <button
                        type="button"
                        className="w-full text-right"
                        onClick={() => {
                          setProgress(item)
                          setWatchingId(announcementDone(item.status) ? null : item.id)
                          void fetchAssemblyAnnouncement(item.id)
                            .then((detail) => {
                              setProgress(detail.announcement)
                              setFailures(detail.failures)
                            })
                            .catch(() => undefined)
                        }}
                      >
                        <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                        <p className="text-xs text-slate-500">
                          {announcementStatusLabel(item.status)} · بريد {item.emailSent}/{item.emailTotal || '—'} · تيليغرام{' '}
                          {item.telegramSent}/{item.telegramTotal || '—'}
                        </p>
                      </button>
                      {item.status === 'queued' || item.status === 'sending' ? (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => void resumeAnnouncement(item)}
                          className="mt-2 text-xs font-semibold text-cyan-800 underline"
                        >
                          متابعة الإرسال
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
