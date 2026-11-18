import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
    isActive
      ? 'bg-brand-light text-brand-ink'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export function Layout() {
  const { session, logout } = useAuth()

  return (
    <div className="min-h-screen" dir="rtl" lang="ar">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2.5">
            <img
              src="/career-mark.svg"
              alt="المسار المهني"
              className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-line transition group-hover:ring-teal-200"
            />
            <span className="leading-tight">
              <span className="block text-base font-extrabold text-slate-900 sm:text-lg">
                المسار المهني
              </span>
              <span className="block text-[11px] font-medium text-slate-500">تجمّع إبتكار</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {session && (
              <>
                <NavLink to="/profile" className={navClass}>
                  سيرتي
                </NavLink>
                <NavLink to="/talent" className={navClass}>
                  تصفح السير
                </NavLink>
              </>
            )}
            {session ? (
              <button type="button" className="btn-ghost py-1.5 text-xs sm:text-sm" onClick={logout}>
                خروج
              </button>
            ) : (
              <Link to="/login" className="btn-primary py-2 text-xs sm:text-sm">
                دخول
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line/70 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 text-center">
          <img src="/career-mark.svg" alt="" className="h-7 w-7 rounded-lg object-cover opacity-90" />
          <p className="text-xs text-slate-400">تجمّع إبتكار · المسار المهني</p>
        </div>
      </footer>
    </div>
  )
}
