import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Sparkles, X } from 'lucide-react'
import { editProjectNoteWithAi } from '../../../api/vms'
import { NoteAiDiffReview } from './NoteAiDiffReview'
import {
  buildNoteDiffSegments,
  listDiffHunks,
  type DiffHunkDecision,
  type NoteDiffSegment,
} from './note-ai-diff'

/** Must match backend `NOTE_AI_PRIMARY_MODEL` (first model in the fallback chain). */
export const NOTE_AI_PRIMARY_MODEL = '@cf/google/gemma-4-26b-a4b-it'

export interface NoteAiCommandControlProps {
  noteId: string
  contentType: 'html' | 'markdown'
  disabled?: boolean
  getContent: () => string
  onApplyContent: (content: string) => void
}

export function NoteAiCommandControl({
  noteId,
  contentType,
  disabled = false,
  getContent,
  onApplyContent,
}: NoteAiCommandControlProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [usedModel, setUsedModel] = useState<string | null>(null)

  const [reviewOpen, setReviewOpen] = useState(false)
  const [diffSegments, setDiffSegments] = useState<NoteDiffSegment[]>([])
  const [decisions, setDecisions] = useState<Record<string, DiffHunkDecision>>({})

  const closeReview = () => {
    setReviewOpen(false)
    setDiffSegments([])
    setDecisions({})
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !reviewOpen) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, reviewOpen])

  useEffect(() => {
    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!reviewOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeReview()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [reviewOpen])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmed = command.trim()
    if (!trimmed || disabled || isRunning) {
      return
    }

    setError(null)
    setSummary(null)
    setUsedModel(null)
    setIsRunning(true)

    try {
      const original = getContent()
      const { edited } = await editProjectNoteWithAi(noteId, {
        command: trimmed,
        content: original,
        contentType,
      })

      const segments = buildNoteDiffSegments(original, edited.content)
      const hunks = listDiffHunks(segments)
      const nextDecisions: Record<string, DiffHunkDecision> = {}
      for (const hunk of hunks) {
        nextDecisions[hunk.id] = 'pending'
      }

      setDiffSegments(segments)
      setDecisions(nextDecisions)
      setSummary(edited.summary?.trim() || null)
      setUsedModel(edited.model?.trim() || NOTE_AI_PRIMARY_MODEL)
      setCommand('')
      setOpen(false)
      setReviewOpen(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تعديل الملاحظة بالذكاء الاصطناعي.',
      )
    } finally {
      setIsRunning(false)
    }
  }

  const setAllDecisions = (decision: DiffHunkDecision) => {
    const next: Record<string, DiffHunkDecision> = {}
    for (const hunk of listDiffHunks(diffSegments)) {
      next[hunk.id] = decision
    }
    setDecisions(next)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
          open
            ? 'border-[#0075de]/40 bg-[#0075de]/10 text-[#0075de]'
            : 'border-[#e6e6e6] bg-white text-[#31302e] hover:bg-black/5'
        }`}
        title="تعديل بالذكاء الاصطناعي"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        AI
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="أمر تعديل الملاحظة بالذكاء الاصطناعي"
          className="absolute end-0 top-[calc(100%+0.4rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#e6e6e6] bg-white p-3 shadow-[rgba(0,0,0,0.08)_0_8px_28px]"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#31302e]">تعديل بالذكاء الاصطناعي</p>
              <p className="mt-0.5 text-[11px] text-[#615d59]">
                اكتب أمراً ثم راجع الفروقات قبل تطبيقها.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#615d59] transition hover:bg-black/5 hover:text-[#31302e]"
              aria-label="إغلاق"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="mb-2 rounded-lg border border-[#e6e6e6] bg-[#f6f5f4] px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#a39e98]">النموذج</p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-[#31302e]" dir="ltr">
              {usedModel || NOTE_AI_PRIMARY_MODEL}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              ref={inputRef}
              value={command}
              disabled={disabled || isRunning}
              onChange={(event) => setCommand(event.target.value)}
              rows={3}
              placeholder="مثال: اختصر النص، أضف عنواناً، ترجم للعربية"
              className="w-full resize-none rounded-lg border border-[#e6e6e6] bg-white px-2.5 py-2 text-[13px] text-[#31302e] outline-none placeholder:text-[#a39e98] focus:border-[#0075de]/50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="أمر تعديل الملاحظة بالذكاء الاصطناعي"
            />
            <button
              type="submit"
              disabled={disabled || isRunning || !command.trim()}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#31302e] px-3 text-[12px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {isRunning ? 'جار التنفيذ...' : 'اقترح التعديلات'}
            </button>
          </form>

          {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <NoteAiDiffReview
              open={reviewOpen}
              segments={diffSegments}
              decisions={decisions}
              summary={summary}
              model={usedModel}
              onDecisionChange={(hunkId, decision) => {
                setDecisions((current) => ({ ...current, [hunkId]: decision }))
              }}
              onAcceptAll={() => setAllDecisions('accepted')}
              onRejectAll={() => setAllDecisions('rejected')}
              onApply={(content) => {
                onApplyContent(content)
                closeReview()
              }}
              onDismiss={closeReview}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
