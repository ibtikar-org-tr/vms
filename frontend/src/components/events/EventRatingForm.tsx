import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import {
  createEventRating,
  fetchEventRatingFields,
  fetchMyEventRating,
} from '../../api/vms'
import type {
  VmsEventRatingEligibilityReason,
  VmsEventRatingField,
  VmsEventRatingMeStatus,
} from '../../types/vms'
import { TextField } from '../registration/TextField'

type EventRatingFormProps = {
  eventId: string
  ratingsEnabled?: boolean
}

function reasonMessage(reason: VmsEventRatingEligibilityReason | null | undefined) {
  if (reason === 'deadline_passed') return 'انتهى موعد التقييم لهذه الفعالية.'
  if (reason === 'not_registered') return 'يجب أن تكون مسجلاً في الفعالية لتتمكن من التقييم.'
  if (reason === 'attendance_not_approved') {
    return 'التقييم متاح فقط للمشاركين الذين تم اعتماد حضورهم.'
  }
  if (reason === 'already_rated') return 'لقد قمت بتقييم هذه الفعالية مسبقاً.'
  if (reason === 'ratings_disabled') return null
  return null
}

export function EventRatingForm({ eventId, ratingsEnabled }: EventRatingFormProps) {
  const [fields, setFields] = useState<VmsEventRatingField[]>([])
  const [status, setStatus] = useState<VmsEventRatingMeStatus | null>(null)
  const [score, setScore] = useState(8)
  const [feedback, setFeedback] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [hideInfo, setHideInfo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ratingsEnabled) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    async function load() {
      setIsLoading(true)
      try {
        const [fieldsPayload, mePayload] = await Promise.all([
          fetchEventRatingFields(eventId),
          fetchMyEventRating(eventId),
        ])
        if (controller.signal.aborted) return
        setFields(fieldsPayload.fields)
        setStatus(mePayload)
        const next: Record<string, string> = {}
        for (const field of fieldsPayload.fields) {
          next[field.id] = ''
        }
        setAnswers(next)
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل نموذج التقييم.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [eventId, ratingsEnabled])

  if (!ratingsEnabled) {
    return null
  }

  if (isLoading) {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <p className="text-sm text-slate-500">جار تحميل نموذج التقييم...</p>
      </article>
    )
  }

  if (status?.hasRated) {
    return (
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-emerald-800" />
          <h2 className="text-base font-semibold text-emerald-950">تم التقييم</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-emerald-900">
          شكراً لمشاركتك. تم تسجيل تقييمك
          {status.hideInfo ? ' مع إخفاء هويتك.' : '.'}
        </p>
        {status.rating ? (
          <p className="mt-2 text-sm font-medium text-emerald-950">تقييمك: {status.rating.score}/10</p>
        ) : null}
      </article>
    )
  }

  if (!status?.canRate) {
    const message = reasonMessage(status?.reason)
    if (!message) {
      return null
    }

    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Star className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">تقييم الفعالية</h2>
        </div>
        <p className="text-sm leading-7 text-slate-600">{message}</p>
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Star className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">تقييم الفعالية</h2>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          setIsSubmitting(true)
          void createEventRating(eventId, {
            score,
            feedback: feedback.trim() || undefined,
            answers,
            hideInfo,
          })
            .then((payload) => {
              setStatus({
                hasRated: true,
                canRate: false,
                reason: 'already_rated',
                rating: payload.rating,
                hideInfo: payload.hideInfo,
              })
            })
            .catch((requestError) => {
              setError(requestError instanceof Error ? requestError.message : 'تعذر إرسال التقييم.')
            })
            .finally(() => setIsSubmitting(false))
        }}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            التقييم من 1 إلى 10<span className="mr-1 font-bold text-red-600">*</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScore(value)}
                disabled={isSubmitting}
                className={`h-10 w-10 rounded-lg border text-sm font-semibold transition ${
                  score === value
                    ? 'border-cyan-700 bg-cyan-700 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                } disabled:opacity-60`}
              >
                {value}
              </button>
            ))}
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-slate-700">
          <span>ملاحظاتك (اختياري)</span>
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
            placeholder="شاركنا رأيك في الفعالية"
          />
        </label>

        {fields.map((field) => (
          <div key={field.id}>
            {field.type === 'textarea' ? (
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-slate-700">
                <span>
                  {field.label}
                  {field.required ? <span className="mr-1 font-bold text-red-600">*</span> : null}
                </span>
                <textarea
                  value={answers[field.id] ?? ''}
                  onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                  required={field.required}
                  rows={4}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
                />
                {field.description ? <p className="text-xs font-normal text-slate-500/70">{field.description}</p> : null}
              </label>
            ) : (
              <TextField
                id={`rating-field-${field.id}`}
                label={field.label}
                value={answers[field.id] ?? ''}
                onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
                type={
                  field.type === 'number'
                    ? 'number'
                    : field.type === 'email'
                      ? 'email'
                      : field.type === 'url'
                        ? 'url'
                        : field.type === 'phone'
                          ? 'tel'
                          : 'text'
                }
                required={field.required}
                helperText={field.description ?? undefined}
              />
            )}
          </div>
        ))}

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
          <input
            type="checkbox"
            checked={hideInfo}
            onChange={(event) => setHideInfo(event.target.checked)}
            disabled={isSubmitting}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-slate-800">إخفاء هويتي</span>
            <span className="block text-xs leading-6 text-slate-500">
              سيتم تسجيل أنك قيّمت الفعالية دون ربط إجاباتك بعضويتك.
            </span>
          </span>
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'جار الإرسال...' : 'إرسال التقييم'}
        </button>
      </form>
    </article>
  )
}
