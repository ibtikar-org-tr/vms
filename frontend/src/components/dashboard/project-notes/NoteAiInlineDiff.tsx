import { Check, CheckCheck, Undo2, X, XCircle } from 'lucide-react'
import {
  composeNoteFromDiffDecisions,
  countHunkDecisions,
  listDiffHunks,
  type DiffHunkDecision,
  type NoteDiffHunk,
  type NoteDiffSegment,
} from './note-ai-diff'

export interface NoteAiProposal {
  segments: NoteDiffSegment[]
  summary: string | null
  model: string | null
}

interface NoteAiInlineDiffProps {
  proposal: NoteAiProposal
  decisions: Record<string, DiffHunkDecision>
  onDecisionChange: (hunkId: string, decision: DiffHunkDecision) => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onApply: (content: string) => void
  onDiscard: () => void
}

function splitDisplayLines(text: string) {
  if (!text) {
    return [] as string[]
  }

  const normalized = text.replace(/\n$/, '')
  if (!normalized) {
    return ['']
  }

  return normalized.split('\n')
}

function FileLines({
  text,
  tone,
}: {
  text: string
  tone: 'unchanged' | 'removed' | 'added' | 'resolved'
}) {
  const lines = splitDisplayLines(text)
  if (lines.length === 0 && tone !== 'unchanged') {
    return (
      <div
        className={`flex border-b border-black/5 font-mono text-[12px] leading-6 ${
          tone === 'removed' ? 'bg-[#fcebec] text-[#a31515]' : 'bg-[#e6ffed] text-[#116329]'
        }`}
      >
        <span className="w-8 shrink-0 select-none border-e border-black/5 px-1 text-center opacity-60">
          {tone === 'removed' ? '−' : '+'}
        </span>
        <span className="px-3 py-0.5 italic opacity-50">(فارغ)</span>
      </div>
    )
  }

  const rowClass =
    tone === 'removed'
      ? 'bg-[#fcebec] text-[#a31515]'
      : tone === 'added'
        ? 'bg-[#e6ffed] text-[#116329]'
        : 'bg-white text-[#31302e]'
  const prefix = tone === 'removed' ? '−' : tone === 'added' ? '+' : ' '
  const textClass = tone === 'removed' ? 'line-through decoration-[#a31515]/50' : ''

  return (
    <>
      {lines.map((line, index) => (
        <div
          key={`${tone}-${index}-${line.slice(0, 32)}`}
          className={`flex border-b border-black/5 font-mono text-[12px] leading-6 ${rowClass}`}
          dir="auto"
        >
          <span className="w-8 shrink-0 select-none border-e border-black/5 px-1 text-center opacity-60">
            {prefix}
          </span>
          <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words px-3 py-0.5 ${textClass}`}>
            {line || ' '}
          </span>
        </div>
      ))}
    </>
  )
}

function InlineHunk({
  hunk,
  decision,
  onDecisionChange,
}: {
  hunk: NoteDiffHunk
  decision: DiffHunkDecision
  onDecisionChange: (hunkId: string, decision: DiffHunkDecision) => void
}) {
  if (decision === 'accepted') {
    return <FileLines text={hunk.newText} tone="resolved" />
  }

  if (decision === 'rejected') {
    return <FileLines text={hunk.oldText} tone="resolved" />
  }

  return (
    <div className="relative">
      <div className="sticky top-10 z-[1] flex items-center justify-end gap-1 border-b border-[#e6e6e6] bg-[#f6f5f4]/95 px-2 py-1 backdrop-blur-sm">
        <span className="me-auto text-[10px] font-medium text-[#a39e98]">تعديل مقترح</span>
        <button
          type="button"
          onClick={() => onDecisionChange(hunk.id, 'accepted')}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-emerald-600 px-2 text-[11px] font-medium text-white transition hover:bg-emerald-700"
        >
          <Check className="h-3 w-3" aria-hidden />
          قبول
        </button>
        <button
          type="button"
          onClick={() => onDecisionChange(hunk.id, 'rejected')}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-red-600 px-2 text-[11px] font-medium text-white transition hover:bg-red-700"
        >
          <X className="h-3 w-3" aria-hidden />
          رفض
        </button>
      </div>
      {hunk.oldText ? <FileLines text={hunk.oldText} tone="removed" /> : null}
      {hunk.newText ? <FileLines text={hunk.newText} tone="added" /> : null}
      {!hunk.oldText && !hunk.newText ? <FileLines text="" tone="added" /> : null}
    </div>
  )
}

export function NoteAiInlineDiff({
  proposal,
  decisions,
  onDecisionChange,
  onAcceptAll,
  onRejectAll,
  onApply,
  onDiscard,
}: NoteAiInlineDiffProps) {
  const hunks = listDiffHunks(proposal.segments)
  const counts = countHunkDecisions(hunks, decisions)
  const identical = hunks.length === 0
  const canApply = !identical && (counts.accepted > 0 || counts.pending === 0)

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="sticky top-0 z-[2] flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e6e6e6] bg-[#f6f5f4] px-3 py-2">
        <p className="me-auto min-w-0 text-[12px] text-[#615d59]">
          {proposal.summary?.trim() || 'مراجعة تعديلات الذكاء الاصطناعي داخل الملف'}
          {identical ? ' — لا توجد فروقات' : null}
        </p>
        {!identical ? (
          <>
            <button
              type="button"
              onClick={onAcceptAll}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-50"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              قبول الكل
            </button>
            <button
              type="button"
              onClick={onRejectAll}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-800 transition hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              رفض الكل
            </button>
            <button
              type="button"
              disabled={!canApply && counts.pending > 0 && counts.accepted === 0}
              onClick={() => {
                // Pending hunks stay as original; accepted take new text.
                onApply(composeNoteFromDiffDecisions(proposal.segments, decisions))
              }}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-[#0075de] px-2.5 text-[11px] font-medium text-white transition hover:bg-[#005bab] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              حفظ في الملاحظة
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#e6e6e6] bg-white px-2.5 text-[11px] font-medium text-[#31302e] transition hover:bg-black/5"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          تجاهل
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {identical ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#615d59]">
            لم يغيّر النموذج محتوى الملاحظة.
          </div>
        ) : (
          proposal.segments.map((segment, index) => {
            if (segment.type === 'unchanged') {
              return <FileLines key={`u-${index}`} text={segment.text} tone="unchanged" />
            }

            return (
              <InlineHunk
                key={segment.hunk.id}
                hunk={segment.hunk}
                decision={decisions[segment.hunk.id] ?? 'pending'}
                onDecisionChange={onDecisionChange}
              />
            )
          })
        )}
      </div>

      {!identical ? (
        <div className="shrink-0 border-t border-[#e6e6e6] bg-[#f6f5f4] px-3 py-1.5 text-[10px] text-[#a39e98]">
          مقبول {counts.accepted} · مرفوض {counts.rejected} · معلّق {counts.pending}
          {proposal.model ? (
            <span className="ms-2 font-mono" dir="ltr">
              {proposal.model}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
