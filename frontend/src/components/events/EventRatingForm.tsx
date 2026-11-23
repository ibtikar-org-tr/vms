import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import {
  createEventRating,
  fetchEventRatingFields,
  fetchMyEventRating,
  updateMyEventRating,
} from '../../api/vms'
import type {
  VmsEventRating,
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
  if (reason === 'anonymous_locked') {
    return 'لقد قيّمت هذه الفعالية مع إخفاء هويتك، لذلك لا يمكن تعديل التقييم لاحقاً.'
  }
  if (reason === 'already_rated') return 'لقد قمت بتقييم هذه الفعالية مسبقاً.'
  if (reason === 'ratings_disabled') return null
  return null
}

function answersFromRating(fields: VmsEventRatingField[], rating: VmsEventRating | null) {
  const next: Record<string, string> = {}
  const byId = new Map((rating?.answers ?? []).map((answer) => [answer.fieldId, answer.value]))
  const byLabel = new Map((rating?.answers ?? []).map((answer) => [answer.label, answer.value]))
  for (const field of fields) {
    next[field.id] = byId.get(field.id) ?? byLabel.get(field.label) ?? ''
  }
  return next
}

export function EventRatingForm({ eventId, ratingsEnabled }: EventRatingFormProps) {
  const [fields, setFields] = useState<VmsEventRatingField[]>([])
  const [status, setStatus] = useState<VmsEventRatingMeStatus | null>(null)
  const [score, setScore] = useState(8)
  const [feedback, setFeedback] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [hideInfo, setHideInfo] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        setScore(mePayload.rating?.score ?? 8)
        setFeedback(mePayload.rating?.feedback ?? '')
        setAnswers(answersFromRating(fieldsPayload.fields, mePayload.rating))
        setIsEditing(false)
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

  const showForm = Boolean(status?.canRate || (status?.canEdit && isEditing))

  if (status?.hasRated && !showForm) {
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
        {status.hideInfo ? (
          <p className="mt-3 text-sm leading-7 text-emerald-900">
            ملاحظة: لأنك أخفيت هويتك لا يمكن تعديل هذا التقييم لاحقاً.
          </p>
        ) : null}
        {status.canEdit ? (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true)
              setSuccess(null)
              setError(null)
              if (status.rating) {
                setScore(status.rating.score)
                setFeedback(status.rating.feedback ?? '')
                setAnswers(answersFromRating(fields, status.rating))
              }
            }}
            className="mt-4 inline-flex rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
          >
            تعديل التقييم
          </button>
        ) : status.reason === 'deadline_passed' || status.reason === 'ratings_disabled' ? (
          <p className="mt-3 text-sm leading-7 text-emerald-900">{reasonMessage(status.reason)}</p>
        ) : null}
      </article>
    )
  }

  if (!showForm) {
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

  const editingExisting = Boolean(status?.hasRated && status.canEdit)

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Star className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">
          {editingExisting ? 'تعديل تقييم الفعالية' : 'تقييم الفعالية'}
        </h2>
      </div>
      {editingExisting ? (
        <p className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-7 text-cyan-950">
          يمكنك تعديل تقييمك وإجابات الأسئلة الإضافية حتى موعد إغلاق التقييم.
        </p>
      ) : null}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          setSuccess(null)
          setIsSubmitting(true)

          const payload = {
            score,
            feedback: feedback.trim() || undefined,
            answers,
          }

          const request = editingExisting
            ? updateMyEventRating(eventId, payload)
            : createEventRating(eventId, { ...payload, hideInfo })

          void request
            .then((response) => {
              setStatus({
                hasRated: true,
                canRate: false,
                canEdit: response.canEdit,
                reason: response.hideInfo ? 'anonymous_locked' : 'already_rated',
                rating: response.rating,
                hideInfo: response.hideInfo,
              })
              if (response.rating) {
                setScore(response.rating.score)
                setFeedback(response.rating.feedback ?? '')
                setAnswers(answersFromRating(fields, response.rating))
              }
              setIsEditing(false)
              setSuccess(editingExisting ? 'تم حفظ تعديلات التقييم.' : 'تم إرسال التقييم بنجاح.')
            })
            .catch((requestError) => {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : editingExisting
                    ? 'تعذر تحديث التقييم.'
                    : 'تعذر إرسال التقييم.',
              )
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

        {!editingExisting ? (
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
                سيتم تسجيل أنك قيّمت الفعالية دون ربط إجاباتك بعضويتك. ملاحظة مهمة: إذا أخفيت هويتك فلن تتمكن من
                تعديل التقييم لاحقاً لأن النظام لن يعرف أي تقييم يخصك.
              </span>
            </span>
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting
              ? editingExisting
                ? 'جار الحفظ...'
                : 'جار الإرسال...'
              : editingExisting
                ? 'حفظ التعديلات'
                : 'إرسال التقييم'}
          </button>
          {editingExisting ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsEditing(false)
                setError(null)
                setSuccess(null)
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              إلغاء
            </button>
          ) : null}
        </div>
      </form>
    </article>
  )
}
