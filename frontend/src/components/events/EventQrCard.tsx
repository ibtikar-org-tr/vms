import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

export function EventQrCard({
  eventId,
  eventName,
  status,
}: {
  eventId: string
  eventName: string
  status?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const eventUrl = useMemo(() => `${window.location.origin}/event/${eventId}`, [eventId])

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(eventUrl, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#134e4a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [eventUrl])

  function downloadPng() {
    if (!dataUrl) return
    const link = document.createElement('a')
    const safeName = eventName.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '-').slice(0, 60) || 'event'
    link.href = dataUrl
    link.download = `${safeName}-qr.png`
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <QrCode className="h-5 w-5 text-teal-700" />
        <h2 className="text-base font-semibold text-slate-900">رمز QR للفعالية</h2>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-inner sm:mx-0">
          {dataUrl ? (
            <img src={dataUrl} alt={`رمز QR لصفحة ${eventName}`} className="h-full w-full object-contain" />
          ) : (
            <p className="text-xs text-slate-500">جار تجهيز الرمز...</p>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm leading-7 text-slate-600">
            أي شخص يمسح هذا الرمز يفتح صفحة الفعالية مباشرة. حمّل الصورة للطباعة أو الملصقات.
          </p>
          <p className="truncate font-mono text-xs text-slate-500" dir="ltr">
            {eventUrl}
          </p>
          {status && status !== 'public' ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-950">
              الفعالية ليست منشورة بعد. الزوار لن يروا الصفحة حتى تُنشر.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!dataUrl}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400"
            >
              <Download className="h-3.5 w-3.5" />
              تحميل الصورة
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
