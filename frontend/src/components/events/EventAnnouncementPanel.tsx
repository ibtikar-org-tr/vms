import { useCallback, useEffect, useState } from 'react'
import { Copy, Mail, Megaphone, Send } from 'lucide-react'
import {
  continueEventAnnouncement,
  createEventAnnouncement,
  fetchEventAnnouncement,
  fetchEventAnnouncements,
  retryEventAnnouncement,
} from '../../api/vms'
import type { EventAnnouncement, EventAnnouncementAudience, EventAnnouncementFailure } from '../../types/vms'

function announcementStatusLabel(status: EventAnnouncement['status']) {
  if (status === 'sent') return 'أُرسلت'
  if (status === 'partial') return 'أُرسلت جزئياً'
  if (status === 'sending' || status === 'queued') return 'جارٍ الإرسال'
  return 'فشلت'
}

function announcementDone(status: EventAnnouncement['status']) {
  return status === 'sent' || status === 'partial' || status === 'failed'
}

function announcementProgress(item: EventAnnouncement) {
  const telegramTotal = item.sendTelegram ? item.telegramTotal : 0
  const emailTotal = item.sendEmail ? item.emailTotal : 0
  const total = telegramTotal + emailTotal
  const done =
    (item.sendTelegram ? item.telegramSent + item.telegramFailed : 0) +
    (item.sendEmail ? item.emailSent + item.emailFailed : 0)
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : item.status === 'queued' ? 2 : 0
  return { percent }
}

function channelLabel(channel: EventAnnouncementFailure['channel']) {
  return channel === 'telegram' ? 'تيليغرام' : 'بريد'
}

function formatTelegramLabel(username: string) {
  const trimmed = username.trim()
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function telegramProfileUrl(username: string) {
  return `https://t.me/${encodeURIComponent(username.replace(/^@/, '').trim())}`
}

function messageCopyText(item: Pick<EventAnnouncement, 'subject' | 'body'>) {
  return `${item.subject.trim()}\n\n${item.body.trim()}`
}

export function EventAnnouncementPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendTelegram, setSendTelegram] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([])
  const [audience, setAudience] = useState<EventAnnouncementAudience>({ people: 0, email: 0, telegram: 0 })
  const [progress, setProgress] = useState<EventAnnouncement | null>(null)
  const [failures, setFailures] = useState<EventAnnouncementFailure[]>([])
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadAnnouncements = useCallback(async () => {
    const payload = await fetchEventAnnouncements(eventId)
    setAnnouncements(payload.announcements)
    setAudience(payload.audience)
    return payload.announcements
  }, [eventId])

  useEffect(() => {
    void loadAnnouncements().catch(() => {
      setAnnouncements([])
    })
  }, [loadAnnouncements])

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1800)
  }

  function fillComposer(item: EventAnnouncement) {
    setSubject(item.subject)
    setBody(item.body)
    setSendError(null)
    setSendSuccess('تم تعبئة النموذج من الرسالة السابقة. يمكنك تعديلها ثم الإرسال.')
  }

  async function pumpAnnouncement(start: EventAnnouncement, startNeedsContinue: boolean) {
    let announcement = start
    let needsContinue = startNeedsContinue
    setProgress(announcement)

    while (needsContinue && announcement?.id) {
      let next: { announcement: EventAnnouncement; queued?: boolean; needsContinue: boolean } | null = null
      let lastError: unknown = null

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 + attempt * 250))
        try {
          next = await continueEventAnnouncement(eventId, announcement.id)
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
        const detail = await fetchEventAnnouncement(eventId, id)
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
            setConfirmed(false)
          }
          await loadAnnouncements()
        }
      } catch {
        // Keep polling.
      }
    }

    void tick(watchingId)
    const handle = window.setInterval(() => void tick(watchingId), 1500)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [eventId, loadAnnouncements, watchingId])

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
      setSendError('أكّد الإرسال للمسجّلين أولاً.')
      return
    }

    setIsSending(true)
    setFailures([])
    try {
      const created = await createEventAnnouncement(eventId, {
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
      const detail = await fetchEventAnnouncement(eventId, announcement.id).catch(() => null)
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
        setConfirmed(false)
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

  async function resumeAnnouncement(item: EventAnnouncement) {
    setSendError(null)
    setSendSuccess(null)
    setIsSending(true)
    try {
      const next = await continueEventAnnouncement(eventId, item.id)
      setProgress(next.announcement)
      if (next.queued || next.needsContinue) {
        setWatchingId(next.announcement.id)
      }
      if (!next.queued && next.needsContinue) {
        await pumpAnnouncement(next.announcement, next.needsContinue)
      }
      if (!next.queued && announcementDone(next.announcement.status)) {
        setIsSending(false)
      }
      await loadAnnouncements()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'تعذر متابعة الإرسال.')
      setIsSending(false)
    }
  }

  async function retryFailed(item: EventAnnouncement, channel: 'email' | 'telegram') {
    setSendError(null)
    setSendSuccess(null)
    setIsSending(true)
    try {
      const next = await retryEventAnnouncement(eventId, item.id, channel)
      setProgress(next.announcement)
      setWatchingId(next.announcement.id)
      if (!next.queued && next.needsContinue) {
        await pumpAnnouncement(next.announcement, next.needsContinue)
      }
      await loadAnnouncements()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'تعذر إعادة الإرسال.')
      setIsSending(false)
    }
  }

  const lastSent = announcements.find((item) => announcementDone(item.status)) ?? announcements[0] ?? null

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <Megaphone className="h-5 w-5 text-cyan-700" />
        <h2 className="text-base font-semibold text-slate-900">رسالة للمسجّلين</h2>
      </div>
      <p className="text-sm leading-7 text-slate-600">
        أرسل رابط مجموعة واتساب، الجدول، أو أي تحديث للمسجّلين الحاليين. البريد يصل للأعضاء والزوار، وتيليغرام يصل للأعضاء المرتبطين بالبوت فقط.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        الجمهور الحالي: {audience.people} مسجّل · بريد {audience.email} · تيليغرام {audience.telegram}
      </p>

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
              placeholder="مثال: مجموعة الواتساب وجدول اليوم"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">نص الرسالة</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              maxLength={8000}
              placeholder={'مثال:\nمجموعة الواتساب: https://chat.whatsapp.com/...\nالحضور الساعة 10:00 في مدارس الهدى.'}
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
            أؤكد إرسال هذه الرسالة لمسجّلي «{eventName}» على القنوات المختارة.
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
            disabled={isSending || audience.people === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-400"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'جارٍ الإرسال...' : 'إرسال للمسجّلين'}
          </button>
        </form>

        <div className="space-y-4">
          {lastSent ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">آخر رسالة</p>
                <button
                  type="button"
                  onClick={() => void copyText('last', messageCopyText(lastSent))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 underline-offset-4 hover:underline"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === 'last' ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{lastSent.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{lastSent.body}</p>
              <button
                type="button"
                onClick={() => fillComposer(lastSent)}
                className="mt-3 text-xs font-semibold text-cyan-800 underline-offset-4 hover:underline"
              >
                استخدم هذه الرسالة في النموذج
              </button>
            </div>
          ) : null}

          {failures.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-950">تعذر الوصول ({failures.length})</p>
              <div className="mt-2 max-h-48 overflow-auto text-xs">
                <table className="w-full text-right">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="px-1 py-1 font-medium">الاسم</th>
                      <th className="px-1 py-1 font-medium">القناة</th>
                      <th className="px-1 py-1 font-medium">التواصل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.slice(0, 40).map((item) => (
                      <tr key={item.id} className="border-t border-red-100">
                        <td className="px-1 py-1.5 text-slate-800">{item.displayName || item.email || '—'}</td>
                        <td className="px-1 py-1.5">{channelLabel(item.channel)}</td>
                        <td className="px-1 py-1.5">
                          {item.channel === 'telegram' && item.telegramUsername ? (
                            <a href={telegramProfileUrl(item.telegramUsername)} className="text-cyan-800 underline" target="_blank" rel="noreferrer">
                              {formatTelegramLabel(item.telegramUsername)}
                            </a>
                          ) : (
                            item.email || item.phoneNumber || '—'
                          )}
                        </td>
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
                <p className="text-xs text-slate-500">لا توجد رسائل بعد. بعد الإرسال تبقى هنا ويمكن نسخها.</p>
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-600">{item.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {announcementStatusLabel(item.status)} · بريد {item.emailSent}/{item.emailTotal || '—'} · تيليغرام{' '}
                      {item.telegramSent}/{item.telegramTotal || '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void copyText(item.id, messageCopyText(item))}
                        className="text-xs font-semibold text-cyan-800 underline"
                      >
                        {copied === item.id ? 'تم النسخ' : 'نسخ الرسالة'}
                      </button>
                      <button type="button" onClick={() => fillComposer(item)} className="text-xs font-semibold text-cyan-800 underline">
                        استخدم في النموذج
                      </button>
                      {item.status === 'queued' || item.status === 'sending' ? (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => void resumeAnnouncement(item)}
                          className="text-xs font-semibold text-cyan-800 underline disabled:opacity-50"
                        >
                          متابعة الإرسال
                        </button>
                      ) : null}
                      {announcementDone(item.status) && (item.emailFailed > 0 || item.telegramFailed > 0) ? (
                        <>
                          {item.telegramFailed > 0 ? (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => void retryFailed(item, 'telegram')}
                              className="text-xs font-semibold text-cyan-800 underline disabled:opacity-50"
                            >
                              إعادة تيليغرام ({item.telegramFailed})
                            </button>
                          ) : null}
                          {item.emailFailed > 0 ? (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => void retryFailed(item, 'email')}
                              className="text-xs font-semibold text-cyan-800 underline disabled:opacity-50"
                            >
                              إعادة البريد ({item.emailFailed})
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
