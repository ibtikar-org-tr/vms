import { Check, CheckCheck, Undo2, X, XCircle } from 'lucide-react'
import {
  composeNoteFromDiffDecisions,
  countHunkDecisions,
  isVisuallyEmptyBlock,
  listDiffHunks,
  type DiffHunkDecision,
  type NoteDiffContentType,
  type NoteDiffHunk,
  type NoteDiffSegment,
} from './note-ai-diff'
import { markdownToHtml } from './note-markdown'

export interface NoteAiProposal {
  segments: NoteDiffSegment[]
  summary: string | null
  model: string | null
  contentType: NoteDiffContentType
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

const proseClass =
  'note-ai-diff-prose text-[16px] leading-[1.5] text-[#31302e] [&_p]:my-2 [&_h1]:my-3 [&_h1]:text-[40px] [&_h1]:font-bold [&_h1]:tracking-[-1px] [&_h2]:my-2.5 [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:tracking-[-0.625px] [&_h3]:my-2 [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:tracking-[-0.25px] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:my-3 [&_blockquote]:border-s-4 [&_blockquote]:border-[#e6e6e6] [&_blockquote]:ps-4 [&_blockquote]:text-[#615d59] [&_a]:text-[#0075de] [&_a]:underline [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through [&_code]:rounded [&_code]:bg-[#f6f5f4] [&_code]:px-1 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#f6f5f4] [&_pre]:p-3'

function toPreviewHtml(content: string, contentType: NoteDiffContentType) {
  if (contentType === 'markdown') {
    return markdownToHtml(content)
  }

  return content.trim() || '<p></p>'
}

function RichBlock({
  content,
  contentType,
  tone,
}: {
  content: string
  contentType: NoteDiffContentType
  tone: 'unchanged' | 'removed' | 'added' | 'resolved'
}) {
  if (isVisuallyEmptyBlock(content, contentType)) {
    return null
  }

  const html = toPreviewHtml(content, contentType)
  const shell =
    tone === 'removed'
      ? 'border-s-4 border-[#f14c4c] bg-[#fcebec]/80'
      : tone === 'added'
        ? 'border-s-4 border-[#2da44e] bg-[#e6ffed]/80'
        : 'border-s-4 border-transparent'
  const bodyTone =
    tone === 'removed' ? 'opacity-80 [&_*]:line-through [&_*]:decoration-[#a31515]/45' : ''

  return (
    <div className={`px-4 py-1 sm:px-5 ${shell}`}>
      <div
        className={`${proseClass} ${bodyTone}`}
        dir="auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function InlineHunk({
  hunk,
  contentType,
  decision,
  onDecisionChange,
}: {
  hunk: NoteDiffHunk
  contentType: NoteDiffContentType
  decision: DiffHunkDecision
  onDecisionChange: (hunkId: string, decision: DiffHunkDecision) => void
}) {
  if (decision === 'accepted') {
    return <RichBlock content={hunk.newText} contentType={contentType} tone="resolved" />
  }

  if (decision === 'rejected') {
    return <RichBlock content={hunk.oldText} contentType={contentType} tone="resolved" />
  }

  return (
    <div className="relative my-1">
      <div className="sticky top-10 z-[1] flex items-center justify-end gap-1 border-y border-[#e6e6e6] bg-[#f6f5f4]/95 px-3 py-1 backdrop-blur-sm">
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
      {hunk.oldText ? (
        <RichBlock content={hunk.oldText} contentType={contentType} tone="removed" />
      ) : null}
      {hunk.newText ? (
        <RichBlock content={hunk.newText} contentType={contentType} tone="added" />
      ) : null}
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
  const contentType = proposal.contentType

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
                onApply(composeNoteFromDiffDecisions(proposal.segments, decisions, contentType))
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

      <div className="min-h-0 flex-1 overflow-auto py-2">
        {identical ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#615d59]">
            لم يغيّر النموذج محتوى الملاحظة.
          </div>
        ) : (
          proposal.segments.map((segment, index) => {
            if (segment.type === 'unchanged') {
              return (
                <RichBlock
                  key={`u-${index}`}
                  content={segment.text}
                  contentType={contentType}
                  tone="unchanged"
                />
              )
            }

            return (
              <InlineHunk
                key={segment.hunk.id}
                hunk={segment.hunk}
                contentType={contentType}
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
