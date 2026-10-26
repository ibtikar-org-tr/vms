import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { FiBookOpen, FiFileText } from 'react-icons/fi'
import { Seo } from '../components/Seo'
import { buildWebPageJsonLd } from '../seo/json-ld'
import { useRegistrationForm } from '../hooks/useRegistrationForm'
import { fetchPublicJson } from '../api/client'
import { MissingRegistrationFieldsNotice } from '../components/registration/MissingRegistrationFieldsNotice'
import { getMissingRequiredRegistrationFields } from '../utils/registrationValidation'
import type { RegistrationFormData } from '../types/registration'
import { getSafeRedirectPath } from '../utils/auth'

const PersonalInfoSection = lazy(() =>
  import('../components/registration/sections/PersonalInfoSection').then((module) => ({ default: module.PersonalInfoSection })),
)
const EducationSection = lazy(() =>
  import('../components/registration/sections/EducationSection').then((module) => ({ default: module.EducationSection })),
)
const ProfileSection = lazy(() =>
  import('../components/registration/sections/ProfileSection').then((module) => ({ default: module.ProfileSection })),
)
const RegistrationInfoSection = lazy(() =>
  import('../components/registration/sections/RegistrationInfoSection').then((module) => ({ default: module.RegistrationInfoSection })),
)
const BylawsAcknowledgementSection = lazy(() =>
  import('../components/registration/sections/BylawsAcknowledgementSection').then((module) => ({ default: module.BylawsAcknowledgementSection })),
)

function hasCompletedNonOptionalFields(formData: RegistrationFormData) {
  return getMissingRequiredRegistrationFields(formData).every(
    (field) => field.fieldId === 'bylaws-acknowledgement',
  )
}

function SectionLoadingCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-white/70 shadow-sm" />
}

function RegistrationTechnicalSupportNotice({ className = 'mt-6' }: { className?: string }) {
  return (
    <aside
      className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600 ${className}`}
    >
      <p>
        إذا واجهت صعوبة تقنية أثناء تعبئة النموذج، يمكنك التواصل معنا عبر{' '}
        <a
          href="https://t.me/ibtikar_org_tr"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cyan-700 underline-offset-4 hover:underline"
          dir="ltr"
        >
          @ibtikar.org.tr
        </a>
        {' '}على تيليغرام.
      </p>
    </aside>
  )
}

const EMAIL_LOCK_HINT = 'لتعديل البريد ارجع إلى صفحة الانتساب واطلب رابطاً جديداً.'

type SignupIntent = {
  channel: 'email' | 'telegram'
  email: string | null
}

export function RegistrationPage() {
  const [searchParams] = useSearchParams()
  const signupToken = searchParams.get('token')?.trim() ?? ''
  const returnPath = useMemo(() => getSafeRedirectPath(searchParams.get('redirect')), [searchParams])
  const signupPath = returnPath ? `/signup?redirect=${encodeURIComponent(returnPath)}` : '/signup'
  const [intent, setIntent] = useState<SignupIntent | null>(null)
  const [intentError, setIntentError] = useState<string | null>(null)
  const [isIntentLoading, setIsIntentLoading] = useState(Boolean(signupToken))
  const lockedEmail = intent?.channel === 'email' ? intent.email : null
  const {
    formData,
    isSubmitting,
    submitError,
    submitSuccessMessage,
    registrationSuccess,
    hasSubmittedForm,
    isAutosaveEnabled,
    updateField,
    handleSubmit,
    toggleAutosave,
  } = useRegistrationForm(signupToken, lockedEmail)
  const canShowBylawsAcknowledgementSection = hasCompletedNonOptionalFields(formData)
  const missingRequiredFields = useMemo(() => {
    const allMissing = getMissingRequiredRegistrationFields(formData)

    if (canShowBylawsAcknowledgementSection) {
      return allMissing
    }

    return allMissing.filter((field) => field.fieldId !== 'bylaws-acknowledgement')
  }, [formData, canShowBylawsAcknowledgementSection])
  const isRegistrationFullyComplete = missingRequiredFields.length === 0
    && getMissingRequiredRegistrationFields(formData).length === 0
  const registrationTitle = 'الانتساب إلى تجمّع إبتكار'
  const registrationDescription =
    'قدّم طلب الانتساب إلى تجمّع إبتكار وابدأ رحلة المشاركة في المشاريع والفعاليات والفرص التطوعية المتاحة للأعضاء الجدد.'
  const registrationJsonLd = useMemo(
    () => buildWebPageJsonLd(registrationTitle, registrationDescription, 'registration'),
    [registrationDescription, registrationTitle],
  )

  useEffect(() => {
    if (!signupToken) {
      return
    }

    let cancelled = false
    setIsIntentLoading(true)
    setIntentError(null)

    fetchPublicJson<SignupIntent>(`/signup/intent?token=${encodeURIComponent(signupToken)}`)
      .then((nextIntent) => {
        if (!cancelled) {
          setIntent(nextIntent)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setIntent(null)
          setIntentError(error instanceof Error ? error.message : 'رابط الانتساب غير صالح.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsIntentLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [signupToken])

  if (!signupToken) {
    return <Navigate to={signupPath} replace />
  }

  return (
    <>
      <Seo
        title={registrationTitle}
        description={registrationDescription}
        keywords="انتساب إبتكار, تسجيل عضوية, نموذج الانتساب, تجمّع إبتكار, تطوع, شباب"
        pathname="/registration"
        jsonLd={registrationJsonLd}
      />
      <main className="min-h-screen bg-linear-to-br from-slate-100 via-cyan-50 to-emerald-100 px-4 py-8 md:px-6 md:py-10" dir="rtl">
        <div className="mx-auto w-full max-w-5xl">
          <header className="relative mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-xl md:p-8">
          <img
            src="/white_long_logo.svg"
            alt="IBTIKAR"
            className="pointer-events-none absolute left-6 top-6 h-8 w-auto opacity-95 md:h-20"
          />
          <p className="mb-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            #جيلٌ_يبتكر
          </p>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">نموذج الانتساب لتجمّع إبتكار</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
            تطوير مهارات الطلاب التقنية وتحفيز الابتكار والإبداع. يرجى ملء هذا النموذج لتقديم طلب الانضمام إلى تجمّع إبتكار.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="https://data.ibtikar.org.tr/documents/ar/intro.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-auto self-start items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white hover:text-slate-900 sm:px-4 sm:py-2 sm:text-sm"
              >
                <FiFileText aria-hidden="true" className="text-sm" />
                <span>الملف التّعريفي</span>
              </a>
              <a
                href="https://github.com/ibtikar-org-tr/bylaws"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-auto self-start items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white hover:text-slate-900 sm:px-4 sm:py-2 sm:text-sm"
              >
                <FiBookOpen aria-hidden="true" className="text-sm" />
                <span>النظام الداخلي</span>
              </a>
            </div>
            <Link
              to={returnPath ?? '/'}
              className="inline-flex w-auto self-end rounded-lg border border-white/50 px-3 py-1.5 text-xs font-medium transition hover:bg-white hover:text-slate-900 sm:self-auto sm:px-4 sm:py-2 sm:text-sm"
            >
              {returnPath ? '← العودة إلى الفعالية' : '← العودة إلى الرئيسية'}
            </Link>
          </div>
        </header>

        {hasSubmittedForm ? (
          <section className="rounded-2xl bg-white p-6 shadow-md md:p-8">
            <h2 className="text-2xl font-black text-emerald-700 md:text-3xl">تم إنشاء العضوية</h2>
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 md:text-base">
              {submitSuccessMessage ?? 'تم إرسال طلب التسجيل بنجاح.'}
            </p>
            {registrationSuccess?.membershipNumber ? (
              <dl className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <dt className="font-semibold text-slate-500">رقم العضوية</dt>
                  <dd className="mt-1 font-mono text-lg font-bold text-slate-900" dir="ltr">{registrationSuccess.membershipNumber}</dd>
                </div>
                {registrationSuccess.temporaryPassword ? (
                  <div>
                    <dt className="font-semibold text-slate-500">كلمة المرور المؤقتة</dt>
                    <dd className="mt-1 font-mono text-lg font-bold text-slate-900" dir="ltr">{registrationSuccess.temporaryPassword}</dd>
                  </div>
                ) : (
                  <p className="text-slate-600">
                    {registrationSuccess.channel === 'telegram'
                      ? 'أُرسلت كلمة المرور أيضاً في محادثة البوت.'
                      : 'أُرسلت كلمة المرور أيضاً إلى بريدك.'}
                  </p>
                )}
              </dl>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
              {registrationSuccess?.channel === 'telegram'
                ? 'يمكنك تسجيل الدخول الآن برقم العضوية أو البريد. سيبقى البريد غير مؤكد في ملفك حتى تضغط رابط التأكيد الذي أرسلناه إليه.'
                : 'قبل تسجيل الدخول افتح بوت تيليغرام وأرسل /verify ثم أدخل رقم العضوية. لن يُفتح الحساب قبل ربط تيليغرام.'}
            </p>
            {registrationSuccess?.channel !== 'telegram' ? (
              <a
                href="https://t.me/ibtikar_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                فتح بوت تيليغرام
              </a>
            ) : (
              <Link
                to="/login"
                className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                تسجيل الدخول
              </Link>
            )}
            {returnPath ? (
              <Link
                to={returnPath}
                className="mt-3 mr-3 inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                العودة إلى الفعالية
              </Link>
            ) : null}
            <RegistrationTechnicalSupportNotice />
          </section>
        ) : isIntentLoading ? (
          <section className="rounded-2xl bg-white p-6 shadow-md">
            <p className="text-sm text-slate-600">جارٍ التحقق من رابط الانتساب...</p>
          </section>
        ) : intentError ? (
          <section className="rounded-2xl bg-white p-6 shadow-md md:p-8">
            <h2 className="text-2xl font-black text-slate-900">تعذّر فتح النموذج</h2>
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {intentError}
            </p>
            <Link
              to={signupPath}
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              العودة إلى صفحة الانتساب
            </Link>
          </section>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
              الحقول المعلّمة بعلامة <span className="font-bold text-red-600">*</span> مطلوبة.
            </p>
            <Suspense fallback={<SectionLoadingCard />}>
              <PersonalInfoSection
                data={formData}
                onFieldChange={updateField}
                readOnlyFields={lockedEmail ? new Set(['email']) : undefined}
                emailReadOnlyHint={lockedEmail ? EMAIL_LOCK_HINT : undefined}
              />
            </Suspense>
            <Suspense fallback={<SectionLoadingCard />}>
              <EducationSection data={formData} onFieldChange={updateField} />
            </Suspense>
            <Suspense fallback={<SectionLoadingCard />}>
              <ProfileSection data={formData} onFieldChange={updateField} />
            </Suspense>
            <Suspense fallback={<SectionLoadingCard />}>
              <RegistrationInfoSection data={formData} onFieldChange={updateField} />
            </Suspense>

            {canShowBylawsAcknowledgementSection ? (
              <Suspense fallback={<SectionLoadingCard />}>
                <BylawsAcknowledgementSection
                  value={formData.bylawsAcknowledgement}
                  onChange={(value) => updateField('bylawsAcknowledgement', value)}
                />
              </Suspense>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                سيظهر قسم إقرار الالتزام بالنظام الداخلي بعد تعبئة جميع الحقول الإلزامية.
              </p>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-md md:p-6">
              <MissingRegistrationFieldsNotice
                missingFields={missingRequiredFields}
                isFullyComplete={isRegistrationFullyComplete}
              />

              <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400 md:w-auto hover:cursor-pointer"
                >
                  {isSubmitting ? 'جارٍ إرسال التسجيل...' : 'إرسال التسجيل'}
                </button>

                <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
                  <p className="text-sm font-semibold text-slate-800 md:text-right">حفظ الجلسة</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAutosaveEnabled}
                    onClick={toggleAutosave}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                      isAutosaveEnabled ? 'bg-sky-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className="sr-only">تفعيل حفظ النموذج محلياً</span>
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        isAutosaveEnabled ? '-translate-x-1' : '-translate-x-6'
                      }`}
                    />
                  </button>
                  {isAutosaveEnabled ? (
                    <p className="max-w-xs text-xs leading-relaxed text-slate-500 md:text-right">يتم حفظ التقدم تلقائياً في المتصفح.</p>
                  ) : (
                    <p className="max-w-xs text-xs leading-relaxed text-slate-400 md:text-right">
                      عند تفعيل هذا الخيار، سيتم حفظ تقدمك في المتصفح تلقائياً لمنع فقدان البيانات عند تحديث الصفحة أو إغلاقها.
                    </p>
                  )}
                </div>
              </div>

              {submitError && (
                <p className="mt-3 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {submitError}
                </p>
              )}
            </div>
            <RegistrationTechnicalSupportNotice />
          </form>
        )}
        </div>
      </main>
    </>
  )
}
