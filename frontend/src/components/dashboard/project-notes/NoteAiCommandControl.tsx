import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { editProjectNoteWithAi } from '../../../api/vms'
import {
  buildNoteDiffSegments,
  listDiffHunks,
  type DiffHunkDecision,
} from './note-ai-diff'
import type { NoteAiProposal } from './NoteAiInlineDiff'
import { NOTE_AI_DEFAULT_MODEL, NOTE_AI_MODELS, type NoteAiModelId } from './note-ai-models'

export { NOTE_AI_DEFAULT_MODEL, NOTE_AI_PRIMARY_MODEL } from './note-ai-models'

export interface NoteAiCommandControlProps {
  noteId: string
  contentType: 'html' | 'markdown'
  disabled?: boolean
  reviewActive?: boolean
  getContent: () => string
  onProposalReady: (proposal: NoteAiProposal) => void
}

export function NoteAiCommandControl({
  noteId,
  contentType,
  disabled = false,
  reviewActive = false,
  getContent,
  onProposalReady,
}: NoteAiCommandControlProps) {
  const panelId = useId()
  const modelSelectId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [selectedModel, setSelectedModel] = useState<NoteAiModelId>(NOTE_AI_DEFAULT_MODEL)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmed = command.trim()
    if (!trimmed || disabled || isRunning || reviewActive) {
      return
    }

    setError(null)
    setIsRunning(true)

    try {
      const original = getContent()
      const { edited } = await editProjectNoteWithAi(noteId, {
        command: trimmed,
        content: original,
        contentType,
        model: selectedModel,
      })

      const segments = buildNoteDiffSegments(original, edited.content, contentType)
      onProposalReady({
        segments,
        summary: edited.summary?.trim() || null,
        model: edited.model?.trim() || selectedModel,
        contentType,
      })
      setCommand('')
      setOpen(false)
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

  const selectedMeta = NOTE_AI_MODELS.find((model) => model.id === selectedModel) ?? NOTE_AI_MODELS[0]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || reviewActive}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
          open || reviewActive
            ? 'border-[#0075de]/40 bg-[#0075de]/10 text-[#0075de]'
            : 'border-[#e6e6e6] bg-white text-[#31302e] hover:bg-black/5'
        }`}
        title={reviewActive ? 'أنهِ مراجعة التعديلات أولاً' : 'تعديل بالذكاء الاصطناعي'}
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
                اختر النموذج ثم اكتب الأمر — ستظهر التعديلات للمراجعة داخل الملف.
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

          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label
                htmlFor={modelSelectId}
                className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#a39e98]"
              >
                النموذج
              </label>
              <select
                id={modelSelectId}
                value={selectedModel}
                disabled={disabled || isRunning}
                onChange={(event) => setSelectedModel(event.target.value as NoteAiModelId)}
                className="w-full cursor-pointer rounded-lg border border-[#e6e6e6] bg-[#f6f5f4] px-2.5 py-2 text-[12px] font-medium text-[#31302e] outline-none focus:border-[#0075de]/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {NOTE_AI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#615d59]">{selectedMeta.description}</p>
              <p className="mt-0.5 break-all font-mono text-[10px] text-[#a39e98]" dir="ltr">
                {selectedModel}
              </p>
            </div>

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
    </div>
  )
}

export function createPendingDecisions(proposal: NoteAiProposal) {
  const decisions: Record<string, DiffHunkDecision> = {}
  for (const hunk of listDiffHunks(proposal.segments)) {
    decisions[hunk.id] = 'pending'
  }
  return decisions
}
