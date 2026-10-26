import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { LazyReveal } from './LazyReveal'

const VolunteersStatsCard = lazy(() =>
  import('./VolunteersStatsCard').then((module) => ({ default: module.VolunteersStatsCard })),
)

function VolunteersCardFallback() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-lg sm:h-56 sm:p-4">
      <div className="h-3.5 w-20 rounded bg-slate-200/80 sm:h-4 sm:w-24" />
      <div className="mt-3 h-6 w-24 rounded bg-slate-200/70 sm:mt-4 sm:h-8 sm:w-32" />
      <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
        <div className="h-11 rounded bg-slate-200/70 sm:h-14" />
        <div className="h-11 rounded bg-slate-200/70 sm:h-14" />
        <div className="h-11 rounded bg-slate-200/70 sm:h-14" />
      </div>
    </div>
  )
}

export function HomeHeroSection() {
  return (
    <div className="space-y-4 sm:space-y-6 md:flex md:h-full md:flex-col md:justify-between md:space-y-0">
      <div className="my-12 space-y-4 sm:my-0 sm:space-y-6">
        <p className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700 sm:px-4 sm:text-sm">
          #جيلٌ_يبتكر
        </p>
        <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          منصّة أعضاء تجمّع إبتكار
        </h1>
        <Link
          to="/signup"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
        >
          نموذج الانتساب لتجمّع إبتكار
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
          >
            تسجيل الدخول
          </Link>
          <Link
            to="/iforgot"
            className="inline-flex w-full items-center justify-center rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline sm:w-auto sm:py-3 sm:text-base"
          >
            نسيت معلوماتي
          </Link>
          <Link
            to="/telegram-bot"
            className="inline-flex w-full items-center justify-center rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline sm:w-auto sm:py-3 sm:text-base"
          >
            تفعيل بوت تيليغرام
          </Link>
        </div>
      </div>
      <Suspense fallback={<VolunteersCardFallback />}>
        <LazyReveal delayMs={120}>
          <VolunteersStatsCard />
        </LazyReveal>
      </Suspense>
    </div>
  )
}