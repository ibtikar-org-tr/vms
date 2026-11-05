import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import {
  createEventFormSubmission,
  fetchMyEventFormSubmission,
  fetchProfile,
} from '../../api/vms'
import type { VmsEventFormField, VmsEventFormSubmission } from '../../types/vms'
import { getStoredUser } from '../../utils/auth'
import { getEmailValidationMessage } from '../../utils/email'
import { EmailField } from '../registration/sections/personal-info-section/EmailField'
import { PhoneNumberField } from '../registration/sections/personal-info-section/PhoneNumberField'
import { TextField } from '../registration/TextField'
import { EventRichText } from './EventRichText'
import { isEventRichTextEmpty } from '../../utils/event-rich-text'

type EventApplicationFormProps = {
  eventId: string
  fields: VmsEventFormField[]
  successMessage?: string | null
  loginRedirect: string
  onSubmitted?: () => void
}

export function EventApplicationForm({
  eventId,
  fields,
  successMessage,
  loginRedirect,
  onSubmitted,
}: EventApplicationFormProps) {
  const user = useMemo(() => getStoredUser(), [])
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<VmsEventFormSubmission | null>(null)

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const field of fields) {
      next[field.id] = ''
    }
    setAnswers(next)
  }, [fields])

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false
    void Promise.all([fetchProfile(user.membershipNumber), fetchMyEventFormSubmission(eventId)])
      .then(([profilePayload, minePayload]) => {
        if (cancelled) return
        if (minePayload.submission) {
          setSubmission(minePayload.submission)
          onSubmitted?.()
          return
        }
        const profile = profilePayload.profile
        setApplicantName(profile.arName?.trim() || profile.enName?.trim() || '')
        setApplicantEmail(profile.email ?? '')
        setApplicantPhone(profile.phoneNumber ?? '')
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [eventId, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const emailError = getEmailValidationMessage(applicantEmail)
    if (emailError) {
      setError(emailError)
      return
    }

    for (const field of fields) {
      const value = (answers[field.id] ?? '').trim()
      if (field.required && !value) {
        setError(`يرجى تعبئة حقل "${field.label}".`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload = await createEventFormSubmission(
        eventId,
        {
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          applicantPhone: applicantPhone.trim(),
          answers,
        },
        { auth: user ? undefined : false },
      )
      setSubmission(payload.submission)
      onSubmitted?.()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر إرسال الطلب.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (fields.length === 0) {
    return null
  }

  if (submission) {
    return (
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-800" />
          <h2 className="text-base font-semibold text-emerald-950">تم استلام طلبك</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-emerald-900">
          شكراً {submission.applicantName}. وصلك تأكيد مبدئي على {submission.applicantEmail}.
        </p>
        {!isEventRichTextEmpty(successMessage) ? (
          <EventRichText value={successMessage} className="mt-3 border-t border-emerald-200/80 pt-3 text-sm text-emerald-950" />
        ) : null}
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <ClipboardList className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">نموذج التقديم</h2>
      </div>
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
        إرسال هذا النموذج منفصل عن اختيار التذكرة. اضغط «إرسال الطلب» هنا لحفظ الإجابات في طلبات النموذج.
      </p>
      {!user ? (
        <p className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-7 text-cyan-950">
          يمكنك التقديم دون حساب. إذا كان لديك عضوية،{' '}
          <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`} className="font-semibold underline">
            سجّل الدخول
          </Link>{' '}
          لتعبئة الاسم والبريد والهاتف تلقائياً.
        </p>
      ) : null}
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField id="applicant-name" label="الاسم الكامل" value={applicantName} onChange={setApplicantName} required />
          </div>
          <div className="md:col-span-2">
            <EmailField id="applicant-email" label="البريد الإلكتروني" value={applicantEmail} onChange={setApplicantEmail} required />
          </div>
          <div className="md:col-span-2">
            <PhoneNumberField value={applicantPhone} onChange={setApplicantPhone} required />
            <p className="mt-1 text-xs text-slate-500">سيتم التواصل عبر هذا الرقم (واتساب). مثال: 05051239898</p>
          </div>
        </div>

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
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                {field.description ? <p className="text-xs font-normal text-slate-500/70">{field.description}</p> : null}
              </label>
            ) : (
              <TextField
                id={`field-${field.id}`}
                label={field.label}
                value={answers[field.id] ?? ''}
                onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
                type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
                required={field.required}
                helperText={field.description ?? undefined}
              />
            )}
          </div>
        ))}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-cyan-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'جار الإرسال...' : 'إرسال الطلب'}
        </button>
      </form>
    </article>
  )
}
