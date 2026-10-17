import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { apiPostJson } from '../api/client'
import { buildWebPageJsonLd } from '../seo/json-ld'
import { getSafeRedirectPath } from '../utils/auth'

const TELEGRAM_SIGNUP_URL = 'https://t.me/ibtikar_bot?start=signup'

export function SignupPage() {
  const [searchParams] = useSearchParams()
  const returnPath = useMemo(() => getSafeRedirectPath(searchParams.get('redirect')), [searchParams])
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const pageTitle = 'الانتساب إلى تجمّع إبتكار'
  const pageDescription = 'اختر الانتساب عبر البريد أو تيليغرام، أو استرجع عضوية سابقة.'
  const pageJsonLd = useMemo(
    () => buildWebPageJsonLd(pageTitle, pageDescription, 'signup'),
    [pageDescription, pageTitle],
  )

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const response = await apiPostJson<{ message: string }, { email: string; redirect?: string }>(
        '/signup/email',
        {
          email: email.trim(),
          redirect: returnPath ?? undefined,
        },
        { auth: false },
      )
      setSuccessMessage(response.message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر إرسال رابط الانتساب.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Seo
        title={pageTitle}
        description={pageDescription}
        keywords="انتساب إبتكار, تسجيل عضوية, تيليغرام, بريد إلكتروني"
        pathname="/signup"
        jsonLd={pageJsonLd}
      />
      <main className="min-h-screen bg-linear-to-br from-slate-100 via-cyan-50 to-emerald-100 px-4 py-8 md:px-6 md:py-10" dir="rtl">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-xl md:p-8">
            <p className="mb-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              #جيلٌ_يبتكر
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">الانتساب إلى تجمّع إبتكار</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200 md:text-base">
              كل عضوية جديدة تبدأ من رابط. اختَر البريد أو تيليغرام، ثم أكمل النموذج من الرابط الذي يصلك.
            </p>
          </header>

          <div className="grid gap-4">
            <section className="rounded-2xl bg-white p-5 shadow-md md:p-6">
              <h2 className="text-xl font-black text-slate-900">الانتساب بالبريد</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                أدخل بريدك لنرسل رابط النموذج. البريد سيكون مثبتاً في النموذج ومؤكداً بعد الإرسال.
              </p>
              <form className="mt-4 space-y-3" onSubmit={handleEmailSignup}>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-email">
                  البريد الإلكتروني
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  placeholder="name@example.com"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? 'جارٍ الإرسال...' : 'إرسال رابط الانتساب'}
                </button>
              </form>
              {successMessage ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  {successMessage}
                </p>
              ) : null}
              {error ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}{' '}
                  <Link to="/iforgot" className="font-bold underline">
                    استرجاع العضوية
                  </Link>
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-md md:p-6">
              <h2 className="text-xl font-black text-slate-900">الانتساب عبر تيليغرام</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                افتح بوت إبتكار وأرسل الأمر <span className="font-mono font-bold" dir="ltr">/signup</span>.
                سيرد البوت برابط النموذج وفيه حساب تيليغرام مثبت مسبقاً.
              </p>
              <a
                href={TELEGRAM_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-800"
              >
                فتح البوت وإرسال /signup
              </a>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-md md:p-6">
              <h2 className="text-xl font-black text-slate-900">استرجاع عضوية سابقة</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                إذا كنت عضواً ونسيت رقم العضوية أو كلمة المرور، انتقل إلى صفحة الاسترجاع.
              </p>
              <Link
                to="/iforgot"
                className="mt-4 inline-flex rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                صفحة نسيت بياناتي
              </Link>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
