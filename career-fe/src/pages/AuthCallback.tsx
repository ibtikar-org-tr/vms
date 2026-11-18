import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import { startVmsSsoLogin } from '../lib/vms-sso'

type ExchangeResult = Awaited<ReturnType<typeof authApi.exchangeVmsCode>>

/** Deduplicate one-time code exchange across React Strict Mode remounts. */
const exchangeByCode = new Map<string, Promise<ExchangeResult>>()

function exchangeVmsCodeOnce(code: string): Promise<ExchangeResult> {
  const existing = exchangeByCode.get(code)
  if (existing) return existing

  const pending = authApi.exchangeVmsCode(code).catch((error) => {
    exchangeByCode.delete(code)
    throw error
  })
  exchangeByCode.set(code, pending)
  return pending
}

function safeNext(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { establish } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')?.trim()
    const next = safeNext(searchParams.get('next'))
    if (!code) {
      setError('رمز الدخول غير موجود. أعد المحاولة من صفحة تسجيل الدخول.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await exchangeVmsCodeOnce(code)
        if (cancelled) return
        await establish(response.access_token, { user: response.user })
        toast.success('تم تسجيل الدخول بنجاح')
        navigate(next, { replace: true })
      } catch (err: any) {
        if (cancelled) return
        const message = err?.response?.data?.message || 'تعذّر إكمال تسجيل الدخول'
        setError(message)
        toast.error(message)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [establish, navigate, searchParams])

  return (
    <section className="panel mx-auto max-w-md p-8 text-center">
      {error ? (
        <div className="space-y-4">
          <p className="text-red-600">{error}</p>
          <button type="button" className="btn-primary" onClick={() => startVmsSsoLogin()}>
            إعادة المحاولة عبر منصة الأعضاء
          </button>
          <Link to="/login" className="block text-sm text-slate-500">
            العودة لصفحة الدخول
          </Link>
        </div>
      ) : (
        <p className="text-slate-600">جاري إكمال تسجيل الدخول…</p>
      )}
    </section>
  )
}
