import { useState } from 'react'
import { Briefcase, ChefHat, ExternalLink, Puzzle } from 'lucide-react'
import { createExternalHandoff } from '../../api/vms'
import { getAppAuthCallbackUrl, listIntegratedApps, type IntegratedApp } from '../../lib/integrations'
import { buildExternalHandoffRedirectUrl } from '../../utils/auth'

const APP_ICONS = {
  kitchen: ChefHat,
  career: Briefcase,
} as const

export function DashboardIntegrationsPage() {
  const apps = listIntegratedApps()
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openApp = async (app: IntegratedApp) => {
    setOpeningId(app.id)
    setError(null)

    // Open synchronously on click so the popup isn't blocked after the async handoff.
    const popup = window.open('about:blank', '_blank')
    if (popup) {
      popup.opener = null
      popup.document.write('<p style="font-family:sans-serif;padding:24px;direction:rtl">جاري فتح التطبيق…</p>')
    }

    try {
      const redirectUri = getAppAuthCallbackUrl(app.url)
      const handoff = await createExternalHandoff({
        redirectUri,
        client: app.client,
      })
      const target = buildExternalHandoffRedirectUrl(handoff.redirectUri, handoff.code)
      if (popup && !popup.closed) {
        popup.location.assign(target)
      } else {
        window.open(target, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close()
      }
      setError(err instanceof Error ? err.message : `تعذّر فتح ${app.nameAr}`)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700">
          <Puzzle className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">التكاملات</h2>
          <p className="mt-1 text-sm text-slate-500">
            التطبيقات المرتبطة بمنصة الأعضاء. اضغط للفتح مع تسجيل الدخول التلقائي.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {apps.map((app) => {
          const Icon = APP_ICONS[app.id]
          const isOpening = openingId === app.id

          return (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => void openApp(app)}
                disabled={openingId !== null}
                className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-right transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-slate-900">{app.nameAr}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">{app.descriptionAr}</span>
                  <span className="mt-2 block truncate text-xs text-slate-400" dir="ltr">
                    {app.url}
                  </span>
                  {isOpening ? (
                    <span className="mt-3 block text-xs font-medium text-indigo-700">
                      جاري فتح التطبيق…
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
