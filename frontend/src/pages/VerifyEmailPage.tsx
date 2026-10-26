import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchPublicJson } from '../api/client'

type VerifyEmailResponse = {
  success: boolean
  alreadyVerified: boolean
  message: string
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('رابط التأكيد غير مكتمل.')
      return
    }

    let cancelled = false
    fetchPublicJson<VerifyEmailResponse>(`/verify-email?token=${encodeURIComponent(token)}`)
      .then((response) => {
        if (!cancelled) {
          setMessage(response.message)
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'تعذّر تأكيد البريد.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10" dir="rtl">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-xl md:p-8">
        <h1 className="text-2xl font-black text-slate-900">تأكيد البريد الإلكتروني</h1>
        {!message && !error ? <p className="mt-4 text-sm text-slate-600">جارٍ تأكيد البريد...</p> : null}
        {message ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        <Link to="/login" className="mt-6 inline-flex text-sm font-bold text-cyan-800 underline">
          تسجيل الدخول
        </Link>
      </section>
    </main>
  )
}
