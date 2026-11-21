import { Link, NavLink, Outlet } from 'react-router-dom'
import { CircleUser, LogIn, LogOut, Shield, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  {
    to: '/profile',
    mobileLabel: 'سيرتي',
    desktopLabel: 'سيرتي',
    icon: CircleUser,
    end: true,
  },
  {
    to: '/profile/access',
    mobileLabel: 'الطلبات',
    desktopLabel: 'طلبات الوصول',
    icon: Shield,
    end: false,
  },
  {
    to: '/talent',
    mobileLabel: 'التصفح',
    desktopLabel: 'تصفح السير',
    icon: Users,
    end: false,
  },
] as const

const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative inline-flex items-center gap-1.5 px-1 py-2 text-sm font-semibold transition',
    isActive
      ? 'text-brand-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
      : 'text-slate-600 hover:text-ink',
  ].join(' ')

const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-semibold transition',
    isActive ? 'text-brand' : 'text-slate-500',
  ].join(' ')

export function Layout() {
  const { session, logout } = useAuth()

  return (
    <div className={`min-h-screen ${session ? 'pb-[4.25rem] md:pb-0' : ''}`} dir="rtl" lang="ar">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <img
              src="/career-mark.svg"
              alt="المسار المهني"
              className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-line sm:h-9 sm:w-9"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-bold text-ink sm:text-base">
                المسار المهني
              </span>
              <span className="hidden text-[11px] text-muted sm:block">تجمّع إبتكار</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-5">
            {session ? (
              <>
                <nav className="hidden items-center gap-5 md:flex" aria-label="التنقل الرئيسي">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={desktopNavClass}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        {item.desktopLabel}
                      </NavLink>
                    )
                  })}
                </nav>

                <span className="hidden h-5 w-px bg-line md:block" aria-hidden />

                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-line hover:bg-slate-50 hover:text-ink"
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

      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-10">
        <Outlet />
      </main>

      {session ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]"
          aria-label="التنقل السفلي"
        >
          <div className="mx-auto flex max-w-lg items-stretch gap-1 px-2 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileNavClass}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span className="truncate">{item.mobileLabel}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      ) : null}

      <footer className="hidden border-t border-line py-5 md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 text-xs text-muted">
          <span>تجمّع إبتكار · المسار المهني</span>
          <img src="/career-mark.svg" alt="" className="h-5 w-5 rounded object-cover opacity-70" />
        </div>
      </footer>
    </div>
  )
}
