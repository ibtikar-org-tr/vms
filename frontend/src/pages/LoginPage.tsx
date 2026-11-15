import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { createExternalHandoff } from '../api/vms'
import { LoginPanel } from '../components/auth/LoginPanel'
import { Seo } from '../components/Seo'
import {
  buildExternalHandoffRedirectUrl,
  getExternalRedirectUri,
  getSafeRedirectPath,
  getStoredUser,
} from '../utils/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [externalHandoffError, setExternalHandoffError] = useState<string | null>(null)
  const [isHandingOff, setIsHandingOff] = useState(false)

  const externalRedirectUri = useMemo(
    () => getExternalRedirectUri(searchParams.get('redirect_uri')),
    [searchParams],
  )
  const externalClient = searchParams.get('client')?.trim() || undefined

  const redirectTo = useMemo(() => {
    const fromQuery = searchParams.get('redirect')
    const fromState = (location.state as { from?: string } | null)?.from
    return getSafeRedirectPath(fromQuery ?? fromState) ?? '/'
  }, [location.state, searchParams])

  const completeExternalHandoff = async () => {
    if (!externalRedirectUri) {
      return false
    }

    setIsHandingOff(true)
    setExternalHandoffError(null)

    try {
      const handoff = await createExternalHandoff({
        redirectUri: externalRedirectUri,
        client: externalClient,
      })
      window.location.assign(buildExternalHandoffRedirectUrl(handoff.redirectUri, handoff.code))
      return true
    } catch (error) {
      setExternalHandoffError(
        error instanceof Error ? error.message : 'تعذر إكمال تسجيل الدخول الخارجي.',
      )
      setIsHandingOff(false)
      return false
    }
  }

  const user = getStoredUser()

  useEffect(() => {
    if (!user || !externalRedirectUri || isHandingOff || externalHandoffError) {
      return
    }

    void completeExternalHandoff()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when already logged in with external redirect
  }, [user, externalRedirectUri])

  if (user && externalRedirectUri) {
    return (
      <>
        <Seo title="تسجيل الدخول" description="جاري إعادة التوجيه..." noIndex />
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6" dir="rtl">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            {externalHandoffError ? (
              <>
                <p className="text-sm text-rose-600">{externalHandoffError}</p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void completeExternalHandoff()}
                >
                  إعادة المحاولة
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-600">جاري إعادتك إلى التطبيق...</p>
            )}
          </div>
        </main>
      </>
    )
  }

  if (user) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <>
      <Seo
        title="تسجيل الدخول"
        description="سجّل الدخول إلى حسابك في منصة أعضاء إبتكار للوصول إلى لوحة التحكم والملف الشخصي والمشاريع والفعاليات."
        noIndex
      />
      {externalHandoffError ? (
        <div className="bg-rose-50 px-4 py-3 text-center text-sm text-rose-700" dir="rtl">
          {externalHandoffError}
        </div>
      ) : null}
      <LoginPanel
        onSuccess={() => {
          if (externalRedirectUri) {
            void completeExternalHandoff()
            return
          }
          navigate(redirectTo, { replace: true })
        }}
      />
    </>
  )
}
