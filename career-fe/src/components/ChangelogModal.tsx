import { Save, X } from 'lucide-react'
import {
  groupChangelog,
  type ChangelogEntry,
  type ChangelogKind,
} from '../lib/profile-changelog'

type Props = {
  open: boolean
  entries: ChangelogEntry[]
  saving?: boolean
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

const KIND_META: Record<
  ChangelogKind,
  { label: string; className: string }
> = {
  added: {
    label: 'إضافة',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  removed: {
    label: 'حذف',
    className: 'bg-rose-50 text-rose-800 ring-rose-200',
  },
  changed: {
    label: 'تعديل',
    className: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
}

export function ChangelogModal({
  open,
  entries,
  saving,
  confirmLabel = 'تأكيد الحفظ',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  const groups = groupChangelog(entries)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="إغلاق"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        className="relative z-10 flex max-h-[min(88vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sheet"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
              مراجعة التغييرات
            </p>
            <h2 id="changelog-title" className="mt-1 text-lg font-bold text-slate-900">
              سجل التعديلات قبل الحفظ
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              راجع ما تغيّر ثم أكّد الحفظ. لم يُرسل أي شيء للخادم بعد.
            </p>
          </div>
          <button type="button" className="btn-ghost px-2 py-2" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              لا توجد تغييرات للحفظ.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.section}>
                  <h3 className="mb-2 text-sm font-bold text-slate-800">{group.section}</h3>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => {
                      const meta = KIND_META[entry.kind]
                      return (
                        <li
                          key={entry.id}
                          className="rounded-xl border border-line bg-slate-50/70 px-3 py-3"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.className}`}
                            >
                              {meta.label}
                            </span>
                            <span className="font-semibold text-slate-900">{entry.label}</span>
                          </div>
                          {entry.kind === 'changed' ? (
                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                              <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-rose-100">
                                <p className="mb-1 text-[11px] font-semibold text-rose-700">قبل</p>
                                <p className="whitespace-pre-wrap break-words text-slate-700">
                                  {entry.before}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-emerald-100">
                                <p className="mb-1 text-[11px] font-semibold text-emerald-700">بعد</p>
                                <p className="whitespace-pre-wrap break-words text-slate-700">
                                  {entry.after}
                                </p>
                              </div>
                            </div>
                          ) : entry.kind === 'added' ? (
                            <p className="whitespace-pre-wrap break-words text-sm text-emerald-800">
                              {entry.after}
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm text-rose-800">
                              {entry.before}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-4 py-3 sm:px-5">
          <button type="button" className="btn-ghost" disabled={saving} onClick={onCancel}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || entries.length === 0}
            onClick={onConfirm}
          >
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
