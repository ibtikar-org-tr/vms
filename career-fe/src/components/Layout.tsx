import { Link, NavLink, Outlet } from 'react-router-dom'
import { CircleUser, LogIn, LogOut, Shield, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative inline-flex items-center gap-1.5 px-1 py-2 text-sm font-semibold transition',
    isActive
      ? 'text-brand-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
      : 'text-slate-600 hover:text-ink',
  ].join(' ')

export function Layout() {
  const { session, logout } = useAuth()

  return (
    <div className="min-h-screen" dir="rtl" lang="ar">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/career-mark.svg"
              alt="المسار المهني"
              className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-line"
            />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold text-ink sm:text-base">المسار المهني</span>
              <span className="block text-[11px] text-muted">تجمّع إبتكار</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            {session ? (
              <>
                <nav className="flex flex-wrap items-center gap-3 sm:gap-5">
                  <NavLink to="/profile" className={navClass}>
                    <CircleUser className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="hidden sm:inline">سيرتي</span>
                  </NavLink>
                  <NavLink to="/profile/access" className={navClass}>
                    <Shield className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="hidden sm:inline">طلبات الوصول</span>
                  </NavLink>
                  <NavLink to="/talent" className={navClass}>
                    <Users className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="hidden sm:inline">تصفح السير</span>
                  </NavLink>
                </nav>

                <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />

                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-line hover:bg-slate-50 hover:text-ink"
                  onClick={logout}
                  aria-label="تسجيل الخروج"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-primary py-2 text-xs sm:text-sm">
                <LogIn className="h-3.5 w-3.5" />
                دخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-7 sm:px-4 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 text-xs text-muted">
          <span>تجمّع إبتكار · المسار المهني</span>
          <img src="/career-mark.svg" alt="" className="h-5 w-5 rounded object-cover opacity-70" />
        </div>
      </footer>
    </div>
  )
}
