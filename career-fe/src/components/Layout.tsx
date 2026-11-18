import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { session, logout } = useAuth()

  return (
    <div className="min-h-screen bg-sand" dir="rtl" lang="ar">
      <header className="border-b border-black/5 bg-sand/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-xl font-bold text-carbon sm:text-2xl">
            المسار المهني · إبتكار
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-carbon sm:gap-3">
            {session && (
              <>
                <NavLink to="/profile" className="hover:text-deep-green">
                  سيرتي
                </NavLink>
                <NavLink to="/talent" className="hover:text-deep-green">
                  تصفح السير
                </NavLink>
              </>
            )}
            {session ? (
              <button type="button" className="btn-ghost" onClick={logout}>
                خروج
              </button>
            ) : (
              <Link to="/login" className="btn-primary">
                دخول
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
