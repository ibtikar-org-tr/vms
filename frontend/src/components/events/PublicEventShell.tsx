import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../Seo'

interface PublicEventShellProps {
  children: ReactNode
}

export function PublicEventShell({ children }: PublicEventShellProps) {
  return (
    <>
      <Seo
        title="تفاصيل الفعالية"
        description="اطّلع على تفاصيل فعاليات تجمّع إبتكار المنشورة واختر التذكرة المناسبة للتسجيل."
        keywords="فعاليات إبتكار, تسجيل فعالية, فعاليات عامة, تجمّع إبتكار"
      />
      <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
        <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link to="/" className="inline-flex items-center">
              <img
                src="/blue_long_logo.svg"
                alt="منصة أعضاء إبتكار"
                className="h-8 w-auto md:h-10"
              />
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link to="/login" className="font-medium text-slate-600 hover:text-slate-900">
                تسجيل الدخول
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700"
              >
                الانتساب
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </>
  )
}
