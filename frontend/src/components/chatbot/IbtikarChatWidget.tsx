import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, MessageCircle, Send, X } from 'lucide-react'
import { askIbtikarChatbot } from '../../api/chatbot'
import { ChatMarkdown } from './ChatMarkdown'

type ChatRole = 'user' | 'assistant'

interface ChatBubble {
  id: string
  role: ChatRole
  content: string
}

const WELCOME_MESSAGE =
  'مرحباً! أنا مساعد إبتكار. اسألني عن الفعاليات، البرامج، فرص التطوع، العضوية، أو عن تجمّع إبتكار.'

function nextId() {
  return crypto.randomUUID()
}

export function IbtikarChatWidget() {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatBubble[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME_MESSAGE },
  ])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const node = listRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
    inputRef.current?.focus()
  }, [open, messages, pending])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || pending) {
      return
    }

    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: question }])
    setPending(true)

    try {
      const result = await askIbtikarChatbot(question)
      const reply = result.reply?.trim() || 'لم أتمكن من توليد إجابة.'
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: reply }])
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : 'تعذّر الاتصال بمساعد إبتكار. حاول مرة أخرى.'
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-80 flex flex-col items-end gap-3">
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label="مساعد إبتكار"
          className="pointer-events-auto flex h-[min(36rem,calc(100vh-5.5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-teal-900/10 bg-white shadow-2xl shadow-teal-950/20"
        >
          <header className="flex items-center justify-between gap-3 bg-teal-700 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">مساعد إبتكار</p>
              <p className="truncate text-xs text-teal-100">فعاليات · تطوع · عضوية · عن إبتكار</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              aria-label="إغلاق المحادثة"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      isUser
                        ? 'rounded-br-md bg-teal-700 text-white whitespace-pre-wrap'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm'
                    }`}
                  >
                    {isUser ? message.content : <ChatMarkdown content={message.content} />}
                  </div>
                </div>
              )
            })}
            {pending ? (
              <div className="flex justify-end">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  جارٍ التفكير…
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            {error ? <p className="mb-2 text-xs text-rose-600">{error}</p> : null}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSubmit(event)
                  }
                }}
                rows={2}
                placeholder="اكتب سؤالك هنا…"
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-teal-600/30 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2"
                disabled={pending}
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="إرسال"
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-950/25 transition hover:bg-teal-800"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
        <span>{open ? 'إغلاق' : 'مساعد إبتكار'}</span>
      </button>
    </div>
  )
}
