import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, MessageCircle, Send } from 'lucide-react'
import { Seo } from '../components/Seo'
import { buildWebPageJsonLd } from '../seo/json-ld'

const TELEGRAM_BOT_URL = 'https://t.me/ibtikar_bot'
const TELEGRAM_CHANNEL_URL = 'https://t.me/ibtikar_org'

const ACTIVATION_STEPS = [
  {
    title: 'افتح بوت إبتكار الرسمي',
    body: 'من تطبيق تيليغرام، ابحث عن البوت أو افتح الرابط أدناه، ثم اضغط «ابدأ» أو «Start».',
  },
  {
    title: 'ابدأ المحادثة',
    body: 'أرسل الأمر /start لعرض رسالة الترحيب وسياسة الخصوصية.',
  },
  {
    title: 'ابدأ التحقق',
    body: 'أرسل الأمر /verify لبدء ربط حساب تيليغرام برقم عضويتك.',
  },
  {
    title: 'اشترك في القناة الرسمية',
    body: 'يُطلب الاشتراك في قناة إبتكار على تيليغرام أولاً. بعد الاشتراك، اضغط «تحققت من الاشتراك» في البوت للمتابعة.',
  },
  {
    title: 'أدخل رقم العضوية',
    body: 'أرسل رقم عضويتك كما هو مسجل في منصة الأعضاء (مثال: 2501270). تأكد من عدم وجود مسافات زائدة.',
  },
  {
    title: 'أكمل التحقق عبر البريد',
    body: 'سيُرسل البوت رمزاً مكوّناً من 6 أرقام إلى بريدك الإلكتروني المسجل. يمكنك إدخال الرمز في المحادثة مع البوت، أو النقر على رابط التحقق في البريد. صلاحية الرمز 10 دقائق.',
  },
  {
    title: 'تأكيد التفعيل',
    body: 'عند نجاح التحقق، ستصلك رسالة تأكيد. بعدها يمكنك استلام الإشعارات ودعوات مجموعات المشاريع والفعاليات عبر البوت.',
  },
] as const

const BOT_COMMANDS = [
  { command: '/start', description: 'رسالة الترحيب ومعلومات البوت' },
  { command: '/signup', description: 'إنشاء رابط انتساب جديد مرتبط بحسابك' },
  { command: '/verify', description: 'ربط حساب تيليغرام برقم عضوية موجودة' },
  { command: '/myinfo', description: 'عرض معلومات عضويتك المسجلة' },
  { command: '/help', description: 'قائمة الأوامر والمساعدة' },
] as const

const TIPS = [
  'يجب أن تكون مسجلاً في منصة الأعضاء ولديك بريد إلكتروني صحيح في ملفك.',
  'لا يمكن ربط رقم عضوية واحد بأكثر من حساب تيليغرام.',
  'إذا نسيت رقم العضوية أو البريد، استخدم صفحة استرجاع البيانات.',
  'للانضمام لمجموعات المشاريع والفعاليات، يجب تفعيل البوت أولاً حتى تصلك الدعوات.',
] as const

export function TelegramBotPage() {
  const pageTitle = 'تفعيل بوت تيليغرام'
  const pageDescription =
    'دليل تفعيل بوت تيليغرام الرسمي لأعضاء إبتكار: الاشتراك في القناة، التحقق من رقم العضوية، واستلام الإشعارات.'
  const pageJsonLd = useMemo(
    () => buildWebPageJsonLd(pageTitle, pageDescription, 'telegram-bot'),
    [pageDescription, pageTitle],
  )

  return (
    <>
      <Seo
        title={pageTitle}
        description={pageDescription}
        keywords="بوت تيليغرام, تفعيل البوت, إبتكار, تيليغرام, رقم العضوية, /verify"
        pathname="/telegram-bot"
        jsonLd={pageJsonLd}
      />
      <main
        className="min-h-screen bg-linear-to-br from-sky-50 via-white to-emerald-50 px-4 py-8 text-slate-800 sm:px-6 sm:py-10"
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-3xl">
          <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur sm:p-8 md:p-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-800">
              <MessageCircle className="size-4" aria-hidden />
              دليل الأعضاء
            </p>

            <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              كيفية تفعيل بوت تيليغرام
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              بوت إبتكار يربط حسابك في المنصة بحسابك على تيليغرام لإرسال إشعارات العضوية، رموز التحقق، ودعوات
              مجموعات المشاريع والفعاليات. اتبع الخطوات التالية مرة واحدة لتفعيل البوت.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <Send className="size-4" aria-hidden />
                فتح البوت على تيليغرام
                <ExternalLink className="size-3.5 opacity-80" aria-hidden />
              </a>
              <a
                href={TELEGRAM_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50"
              >
                القناة الرسمية
                <ExternalLink className="size-3.5 text-slate-500" aria-hidden />
              </a>
            </div>

            <ol className="mt-10 space-y-4">
              {ACTIVATION_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">{step.title}</h2>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{step.body}</p>
                    {index === 3 ? (
                      <a
                        href={TELEGRAM_CHANNEL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
                      >
                        @ibtikar_org
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <section className="mt-10">
              <h2 className="text-lg font-bold text-slate-900">أوامر البوت</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold">الأمر</th>
                      <th className="px-4 py-3 text-right font-semibold">الوظيفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {BOT_COMMANDS.map((row) => (
                      <tr key={row.command}>
                        <td className="px-4 py-3 font-mono text-xs text-sky-800 sm:text-sm" dir="ltr">
                          {row.command}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 sm:px-5">
              <h2 className="text-base font-bold text-amber-950">ملاحظات مهمة</h2>
              <ul className="mt-3 list-disc space-y-2 pr-5 text-sm leading-7 text-amber-950/90">
                {TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
              <h2 className="text-base font-bold text-slate-900">ماذا بعد التفعيل؟</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                بعد ربط البوت يمكنك استلام تنبيهات المنصة على تيليغرام، وطلب دعوات مجموعات المشاريع والأندية
                والفعاليات من لوحة التحكم. إذا طُلب منك الانضمام لمجموعة ولم تصلك الدعوة، تأكد أن البوت مفعّل
                وأنك أرسلت /start للبوت مرة واحدة على الأقل.
              </p>
            </section>

            <nav className="mt-8 flex flex-col gap-2 border-t border-slate-100 pt-6 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link to="/iforgot" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
                نسيت رقم العضوية أو البريد؟
              </Link>
              <Link to="/login" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
                تسجيل الدخول
              </Link>
              <Link to="/signup" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
                تسجيل عضو جديد
              </Link>
              <Link to="/" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
                الصفحة الرئيسية
              </Link>
            </nav>
          </section>
        </div>
      </main>
    </>
  )
}
