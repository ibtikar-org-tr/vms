import { RotateCcw, X } from 'lucide-react'

type Props = {
  open: boolean
  savedAt?: string | null
  onKeep: () => void
  onDiscard: () => void
}

function formatSavedAt(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function DraftRestoredModal({ open, savedAt, onKeep, onDiscard }: Props) {
  if (!open) return null
  const when = formatSavedAt(savedAt)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="إغلاق"
        onClick={onKeep}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-restored-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-line bg-white shadow-sheet"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-light text-brand">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <h2 id="draft-restored-title" className="text-lg font-bold text-ink">
                تم استرجاع تعديلات غير محفوظة
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                وجدنا مسودة محلية في هذا المتصفح من جلسة سابقة. أعدنا تحميلها حتى لا تفقد عملك.
                {when ? (
                  <>
                    <br />
                    <span className="text-xs">آخر حفظ محلي: {when}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <button type="button" className="btn-ghost px-2 py-2" onClick={onKeep}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-5">
          <button type="button" className="btn-ghost" onClick={onDiscard}>
            تجاهل المسودة المحلية
          </button>
          <button type="button" className="btn-primary" onClick={onKeep}>
            متابعة بالتعديلات المسترجعة
          </button>
        </div>
      </div>
    </div>
  )
}
