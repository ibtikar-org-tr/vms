import { type FormEvent, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { login } from '../../api/vms'
import { setStoredSession } from '../../utils/auth'
import { isTelegramActivationRequiredError } from '../../utils/login-errors'

const TELEGRAM_BOT_URL = 'https://t.me/ibtikar_bot'

interface LoginPanelProps {
  onSuccess?: () => void
}

export function LoginPanel({ onSuccess }: LoginPanelProps) {
  const [searchParams] = useSearchParams()
  const registrationRedirect = searchParams.get('redirect')
  const registrationPath = registrationRedirect
    ? `/signup?redirect=${encodeURIComponent(registrationRedirect)}`
    : '/signup'
  const [error, setError] = useState<string | null>(null)
  const [telegramActivationRequired, setTelegramActivationRequired] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setTelegramActivationRequired(false)

    const formData = new FormData(event.currentTarget)
    const identifier = String(formData.get('identifier') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (!identifier || !password) {
      setError('يرجى إدخال البريد الإلكتروني أو رقم العضوية وكلمة المرور.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = await login({ identifier, password })
      setStoredSession(payload.user, payload.accessToken)
      onSuccess?.()
    } catch (requestError) {
      if (isTelegramActivationRequiredError(requestError)) {
        setTelegramActivationRequired(true)
        setError(null)
        return
      }

      setTelegramActivationRequired(false)
      if (requestError instanceof Error) {
        setError(requestError.message)
      } else {
        setError('تعذر تسجيل الدخول.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-cyan-50 via-white to-amber-50 px-6 py-10 text-slate-800" dir="rtl">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-2xl backdrop-blur md:grid-cols-2">
          <div className="space-y-6 bg-linear-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white md:p-10">
            <p className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-cyan-100">
              بوابة الأعضاء
            </p>
            <h1 className="text-3xl font-black leading-tight md:text-4xl">تسجيل الدخول إلى حسابك</h1>
            <p className="text-sm leading-7 text-slate-200">
              استخدم بريدك الإلكتروني وكلمة المرور للوصول إلى لوحة التحكّم.
            </p>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-cyan-50">
              لست عضواً في تجمّع إبتكار؟{' '}
              <Link to={registrationPath} className="font-semibold text-amber-200 underline-offset-4 hover:underline">
                قم بالانتساب للتجمّع الآن
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-8 md:p-10" noValidate>
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-semibold text-slate-700">
                البريد الإلكتروني أو رقم العضوية
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="example@domain.com / 2503017"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 transition hover:text-slate-800"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600">
                <input type="checkbox" name="remember" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
                تذكرني
              </label>
              <Link to="/iforgot" className="font-medium text-cyan-700 transition hover:text-cyan-900">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
            >
              {isSubmitting ? 'جار تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>

            {telegramActivationRequired ? (
              <div
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                role="status"
              >
                <p className="font-semibold">تفعيل بوت تيليغرام مطلوب</p>
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-100/60 px-3 py-2 leading-7">
                  للعلم: إذا ظهرت لك هذه الرسالة، فهذا يعني أن كلمة المرور التي أدخلتها صحيحة.
                </p>
                <p className="mt-2 leading-7">
                  يجب تفعيل بوت تيليغرام قبل تسجيل الدخول. افتح البوت وأرسل{' '}
                  <span className="font-mono font-semibold" dir="ltr">
                    /verify
                  </span>{' '}
                  ثم أكمل التحقق.
                </p>
                <p className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-900 underline-offset-4 hover:underline"
                  >
                    فتح البوت على تيليغرام
                  </a>
                  <Link
                    to="/telegram-bot"
                    className="font-semibold text-amber-900 underline-offset-4 hover:underline"
                  >
                    دليل التفعيل خطوة بخطوة
                  </Link>
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            <p className="text-center text-sm text-slate-600">
              <Link to="/" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
                العودة إلى الصفحة الرئيسية
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
