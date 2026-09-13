import { Check, CheckCheck, X, XCircle } from 'lucide-react'
import {
  composeNoteFromDiffDecisions,
  countHunkDecisions,
  listDiffHunks,
  type DiffHunkDecision,
  type NoteDiffHunk,
  type NoteDiffSegment,
} from './note-ai-diff'

interface NoteAiDiffReviewProps {
  open: boolean
  segments: NoteDiffSegment[]
  decisions: Record<string, DiffHunkDecision>
  summary?: string | null
  model?: string | null
  onDecisionChange: (hunkId: string, decision: DiffHunkDecision) => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onApply: (content: string) => void
  onDismiss: () => void
}

function DiffLines({ text, tone }: { text: string; tone: 'old' | 'new' | 'same' }) {
  if (!text) {
    return (
      <div
        className={`px-3 py-1 font-mono text-[11px] italic ${
          tone === 'old'
            ? 'bg-red-50 text-red-400'
            : tone === 'new'
              ? 'bg-emerald-50 text-emerald-400'
              : 'bg-white text-[#a39e98]'
        }`}
      >
        (فارغ)
      </div>
    )
  }

  const lines = text.replace(/\n$/, '').split('\n')
  const toneClass =
    tone === 'old'
      ? 'bg-red-50 text-red-800'
      : tone === 'new'
        ? 'bg-emerald-50 text-emerald-900'
        : 'bg-white text-[#31302e]'
  const prefix = tone === 'old' ? '−' : tone === 'new' ? '+' : ' '

  return (
    <div className={toneClass} dir="auto">
      {lines.map((line, index) => (
        <div
          key={`${tone}-${index}-${line.slice(0, 24)}`}
          className="flex gap-2 border-b border-black/5 px-3 py-0.5 font-mono text-[11px] leading-5 last:border-b-0"
        >
          <span className="w-3 shrink-0 select-none opacity-60" aria-hidden>
            {prefix}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line || ' '}</span>
        </div>
      ))}
    </div>
  )
}

function HunkCard({
  hunk,
  decision,
  index,
  total,
  onDecisionChange,
}: {
  hunk: NoteDiffHunk
  decision: DiffHunkDecision
  index: number
  total: number
  onDecisionChange: (hunkId: string, decision: DiffHunkDecision) => void
}) {
  const ring =
    decision === 'accepted'
      ? 'ring-1 ring-emerald-400'
      : decision === 'rejected'
        ? 'ring-1 ring-red-300'
        : 'ring-1 ring-[#e6e6e6]'

  return (
    <section className={`overflow-hidden rounded-xl border border-[#e6e6e6] bg-white ${ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6e6e6] bg-[#f6f5f4] px-3 py-2">
        <p className="text-[12px] font-semibold text-[#31302e]">
          تعديل {index + 1} من {total}
          {decision === 'accepted' ? (
            <span className="ms-2 text-[11px] font-medium text-emerald-700">مقبول</span>
          ) : decision === 'rejected' ? (
            <span className="ms-2 text-[11px] font-medium text-red-600">مرفوض</span>
          ) : (
            <span className="ms-2 text-[11px] font-medium text-[#a39e98]">بانتظار القرار</span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDecisionChange(hunk.id, 'accepted')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition ${
              decision === 'accepted'
                ? 'bg-emerald-600 text-white'
                : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            قبول
          </button>
          <button
            type="button"
            onClick={() => onDecisionChange(hunk.id, 'rejected')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition ${
              decision === 'rejected'
                ? 'bg-red-600 text-white'
                : 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
            }`}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            رفض
          </button>
        </div>
      </div>

      {hunk.oldText ? <DiffLines text={hunk.oldText} tone="old" /> : null}
      {hunk.newText ? <DiffLines text={hunk.newText} tone="new" /> : null}
      {!hunk.oldText && !hunk.newText ? <DiffLines text="" tone="same" /> : null}
    </section>
  )
}

export function NoteAiDiffReview({
  open,
  segments,
  decisions,
  summary,
  model,
  onDecisionChange,
  onAcceptAll,
  onRejectAll,
  onApply,
  onDismiss,
}: NoteAiDiffReviewProps) {
  if (!open) {
    return null
  }

  const hunks = listDiffHunks(segments)
  const counts = countHunkDecisions(hunks, decisions)
  const identical = hunks.length === 0
  const canApply = !identical && counts.accepted > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="مراجعة تعديلات الذكاء الاصطناعي"
        className="flex max-h-[min(92dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e6e6e6] bg-white shadow-[rgba(0,0,0,0.12)_0_16px_48px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e6e6e6] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#31302e]">مراجعة تعديلات AI</h2>
            <p className="mt-0.5 text-[12px] text-[#615d59]">
              راجع كل فرق واقبل أو ارفض قبل تطبيقه على الملاحظة.
            </p>
            {summary ? <p className="mt-2 text-[12px] text-[#31302e]">{summary}</p> : null}
            {model ? (
              <p className="mt-1 font-mono text-[10px] text-[#a39e98]" dir="ltr">
                {model}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#615d59] transition hover:bg-black/5 hover:text-[#31302e]"
            aria-label="إغلاق المراجعة"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3 sm:px-5">
          {identical ? (
            <div className="rounded-xl border border-dashed border-[#e6e6e6] bg-[#f6f5f4] px-4 py-8 text-center text-[13px] text-[#615d59]">
              لم يُجرِ النموذج أي تغيير على النص.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onAcceptAll}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  قبول الكل
                </button>
                <button
                  type="button"
                  onClick={onRejectAll}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-800 transition hover:bg-red-100"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden />
                  رفض الكل
                </button>
                <span className="text-[11px] text-[#a39e98]">
                  مقبول {counts.accepted} · مرفوض {counts.rejected} · معلّق {counts.pending}
                </span>
              </div>

              {segments.map((segment, index) => {
                if (segment.type === 'unchanged') {
                  if (!segment.text.trim()) {
                    return null
                  }

                  return (
                    <details
                      key={`unchanged-${index}`}
                      className="overflow-hidden rounded-xl border border-[#e6e6e6] bg-[#fafafa]"
                    >
                      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-[#a39e98]">
                        نص بدون تغيير (عرض)
                      </summary>
                      <DiffLines text={segment.text} tone="same" />
                    </details>
                  )
                }

                const hunkOrder = hunks.findIndex((item) => item.id === segment.hunk.id)
                return (
                  <HunkCard
                    key={segment.hunk.id}
                    hunk={segment.hunk}
                    decision={decisions[segment.hunk.id] ?? 'pending'}
                    index={hunkOrder}
                    total={hunks.length}
                    onDecisionChange={onDecisionChange}
                  />
                )
              })}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e6e6e6] bg-[#f6f5f4] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#e6e6e6] bg-white px-3 text-[12px] font-medium text-[#31302e] transition hover:bg-black/5"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => onApply(composeNoteFromDiffDecisions(segments, decisions))}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#0075de] px-3 text-[12px] font-medium text-white transition hover:bg-[#005bab] disabled:cursor-not-allowed disabled:opacity-40"
          >
            تطبيق المقبولة ({counts.accepted})
          </button>
        </div>
      </div>
    </div>
  )
}
