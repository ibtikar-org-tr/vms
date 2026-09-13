import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import type * as awarenessProtocol from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type { NoteEditorViewMode } from './NoteEditorToolbar'
import { NoteAiCommandControl, createPendingDecisions } from './NoteAiCommandControl'
import { NoteAiInlineDiff, type NoteAiProposal } from './NoteAiInlineDiff'
import type { DiffHunkDecision } from './note-ai-diff'
import { NoteMarkdownCodeEditor } from './NoteMarkdownCodeEditor'
import { NoteMarkdownEditorToolbar } from './NoteMarkdownEditorToolbar'
import { NoteOnlineUsers, type ResolvedOnlineUser } from './NoteOnlineUsers'
import {
  beautifyNoteMarkdown,
  formatNoteMarkdownForEditing,
  htmlToMarkdown,
  markdownToHtml,
  normalizeNoteMarkdownInput,
  replaceYTextContent,
} from './note-markdown'

interface CollaborativeMarkdownEditorProps {
  noteId: string
  yDoc: Y.Doc | null
  awareness: awarenessProtocol.Awareness | null
  initialContent?: string
  readOnly?: boolean
  connectionState: 'idle' | 'connecting' | 'connected' | 'error'
  /** True after the first Yjs sync step-2 from the room — required before SQL seeding. */
  isSynced?: boolean
  onlineUsers: ResolvedOnlineUser[]
  displayName: string
  membershipNumber: string
}

const editorSurfaceClass =
  'h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:px-5 [&_.ProseMirror]:py-5 [&_.ProseMirror]:text-[16px] [&_.ProseMirror]:leading-[1.5] [&_.ProseMirror]:text-black [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h1]:my-3 [&_.ProseMirror_h1]:text-[40px] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:tracking-[-1px] [&_.ProseMirror_h2]:my-2.5 [&_.ProseMirror_h2]:text-[26px] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:tracking-[-0.625px] [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_h3]:text-[22px] [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:tracking-[-0.25px] [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-6 [&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-s-4 [&_.ProseMirror_blockquote]:border-[#e6e6e6] [&_.ProseMirror_blockquote]:ps-4 [&_.ProseMirror_blockquote]:text-[#615d59] [&_.ProseMirror_a]:text-[#0075de] [&_.ProseMirror_a]:underline [&_.ProseMirror_hr]:my-4 [&_.ProseMirror_hr]:border-[#e6e6e6] [&_.ProseMirror_s]:text-[#615d59] [&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:bg-[#f6f5f4] [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-[#f6f5f4] [&_.ProseMirror_code]:px-1 [&_.ProseMirror_.is-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-empty:first-child::before]:float-left [&_.ProseMirror_.is-empty:first-child::before]:h-0 [&_.ProseMirror_.is-empty:first-child::before]:text-[#a39e98] [&_.ProseMirror_.is-empty:first-child::before]:content-[attr(data-placeholder)]'

function connectionLabel(
  connectionState: CollaborativeMarkdownEditorProps['connectionState'],
  readOnly: boolean,
) {
  if (readOnly) {
    return 'وضع المشاهدة فقط'
  }

  switch (connectionState) {
    case 'connected':
      return 'متصل — التعديلات تُزامَن مباشرة'
    case 'connecting':
      return 'جار إعادة الاتصال...'
    case 'error':
      return 'تعذر الاتصال — سيتم إعادة المحاولة تلقائياً'
    default:
      return 'في انتظار الاتصال'
  }
}

export function CollaborativeMarkdownEditor({
  noteId,
  yDoc,
  awareness,
  initialContent = '',
  readOnly = false,
  connectionState,
  isSynced = false,
  onlineUsers,
  displayName,
  membershipNumber,
}: CollaborativeMarkdownEditorProps) {
  const hasSeededRef = useRef(false)
  const seedNoteIdRef = useRef<string | null>(null)
  const markdownDirtyRef = useRef(false)
  const applyingRemoteRef = useRef(false)
  const applyingLocalRef = useRef(false)
  const [viewMode, setViewMode] = useState<NoteEditorViewMode>('visual')
  const [markdownSource, setMarkdownSource] = useState('')
  const [markdownApplyError, setMarkdownApplyError] = useState<string | null>(null)
  const [aiProposal, setAiProposal] = useState<NoteAiProposal | null>(null)
  const [aiDecisions, setAiDecisions] = useState<Record<string, DiffHunkDecision>>({})

  const yText = useMemo(() => (yDoc ? yDoc.getText('markdown') : null), [yDoc])
  const isCollaborative = Boolean(yDoc && awareness && !readOnly)
  const canEdit = isCollaborative

  const staticContent = useMemo(() => markdownToHtml(initialContent), [initialContent])

  const editor = useEditor(
    {
      editable: isCollaborative,
      extensions: [
        StarterKit.configure({
          history: isCollaborative ? false : undefined,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'note-md-link',
          },
        }),
        Placeholder.configure({
          placeholder: readOnly
            ? 'يمكنك مشاهدة هذه الملاحظة فقط.'
            : isCollaborative
              ? 'ابدأ الكتابة بـ Markdown...'
              : 'جار تحميل المحرر...',
        }),
      ],
      content: readOnly ? staticContent : '<p></p>',
      editorProps: {
        attributes: {
          class: 'note-rich-text note-markdown-visual',
          dir: 'auto',
        },
      },
    },
    [noteId, readOnly, isCollaborative],
  )

  useEffect(() => {
    if (seedNoteIdRef.current !== noteId) {
      seedNoteIdRef.current = noteId
      hasSeededRef.current = false
      setViewMode('visual')
      setMarkdownSource('')
      setMarkdownApplyError(null)
      markdownDirtyRef.current = false
      setAiProposal(null)
      setAiDecisions({})
    }
  }, [noteId])

  // Seed Y.Text from SQL only after Yjs sync, then mirror into TipTap.
  useEffect(() => {
    if (!editor || !yText || !yDoc || readOnly || !isSynced || hasSeededRef.current) {
      return
    }

    if (yText.length > 0) {
      applyingRemoteRef.current = true
      editor.commands.setContent(markdownToHtml(yText.toString()), false)
      applyingRemoteRef.current = false
      hasSeededRef.current = true
      return
    }

    const seed = initialContent.trim()
    if (!seed) {
      hasSeededRef.current = true
      return
    }

    applyingLocalRef.current = true
    yDoc.transact(() => {
      replaceYTextContent(yText, seed)
    })
    applyingLocalRef.current = false

    applyingRemoteRef.current = true
    editor.commands.setContent(markdownToHtml(seed), false)
    applyingRemoteRef.current = false
    hasSeededRef.current = true
  }, [editor, initialContent, isSynced, readOnly, yDoc, yText])

  // Visual TipTap → Y.Text (source of truth for markdown notes).
  useEffect(() => {
    if (!editor || !yText || !yDoc || readOnly) {
      return
    }

    const syncMarkdownFromEditor = () => {
      if (applyingRemoteRef.current || viewMode !== 'visual') {
        return
      }

      const nextMarkdown = htmlToMarkdown(editor.getHTML())
      applyingLocalRef.current = true
      yDoc.transact(() => {
        replaceYTextContent(yText, nextMarkdown)
      })
      applyingLocalRef.current = false
    }

    editor.on('update', syncMarkdownFromEditor)
    return () => {
      editor.off('update', syncMarkdownFromEditor)
    }
  }, [editor, readOnly, viewMode, yDoc, yText])

  // Remote Y.Text → TipTap (and Markdown pane when not dirty).
  useEffect(() => {
    if (!editor || !yText || readOnly) {
      return
    }

    const observer = () => {
      if (applyingLocalRef.current) {
        return
      }

      const nextMarkdown = yText.toString()

      if (viewMode === 'visual') {
        applyingRemoteRef.current = true
        editor.commands.setContent(markdownToHtml(nextMarkdown), false)
        applyingRemoteRef.current = false
      } else if (viewMode === 'markdown' && !markdownDirtyRef.current) {
        setMarkdownSource(formatNoteMarkdownForEditing(nextMarkdown))
      }
    }

    yText.observe(observer)
    return () => {
      yText.unobserve(observer)
    }
  }, [editor, readOnly, viewMode, yText])

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(canEdit && viewMode === 'visual')
  }, [canEdit, editor, viewMode])

  useEffect(() => {
    if (!editor || !readOnly) {
      return
    }

    editor.commands.setContent(staticContent, false)
  }, [editor, readOnly, staticContent])

  useEffect(() => {
    if (!awareness || readOnly) {
      return
    }

    awareness.setLocalStateField('notePresence', {
      membershipNumber,
      displayName,
    })
  }, [awareness, displayName, membershipNumber, readOnly])

  // Keep the Markdown pane in sync with collaborative visual edits until the user edits the source.
  useEffect(() => {
    if (!editor || viewMode !== 'markdown' || markdownDirtyRef.current) {
      return
    }

    const syncMarkdownFromEditor = () => {
      if (markdownDirtyRef.current) {
        return
      }

      setMarkdownSource(formatNoteMarkdownForEditing(htmlToMarkdown(editor.getHTML())))
    }

    syncMarkdownFromEditor()
    editor.on('update', syncMarkdownFromEditor)

    return () => {
      editor.off('update', syncMarkdownFromEditor)
    }
  }, [editor, viewMode])

  const resolveCurrentMarkdown = () => {
    if (yText && yText.length > 0) {
      return formatNoteMarkdownForEditing(yText.toString())
    }

    if (editor) {
      return formatNoteMarkdownForEditing(htmlToMarkdown(editor.getHTML()))
    }

    if (readOnly) {
      return formatNoteMarkdownForEditing(initialContent)
    }

    return formatNoteMarkdownForEditing(initialContent)
  }

  const handleViewModeChange = (nextMode: NoteEditorViewMode) => {
    if (nextMode === viewMode) {
      return
    }

    setMarkdownApplyError(null)

    if (nextMode === 'markdown') {
      markdownDirtyRef.current = false
      setMarkdownSource(resolveCurrentMarkdown())
      setViewMode('markdown')
      return
    }

    if (!editor) {
      setViewMode('visual')
      return
    }

    if (readOnly || !canEdit) {
      markdownDirtyRef.current = false
      setViewMode('visual')
      return
    }

    try {
      const normalized = normalizeNoteMarkdownInput(markdownSource)
      const html = markdownToHtml(normalized)
      const applied = editor.commands.setContent(html, true)

      if (!applied) {
        setMarkdownApplyError('تعذر تطبيق Markdown. تحقق من الصيغة ثم حاول مرة أخرى.')
        return
      }

      if (yText && yDoc) {
        applyingLocalRef.current = true
        yDoc.transact(() => {
          replaceYTextContent(yText, normalized.trim())
        })
        applyingLocalRef.current = false
      }

      markdownDirtyRef.current = false
      setMarkdownSource(formatNoteMarkdownForEditing(normalized))
      setViewMode('visual')
    } catch {
      setMarkdownApplyError('تعذر تطبيق Markdown. تحقق من الصيغة ثم حاول مرة أخرى.')
    }
  }

  const statusTone =
    readOnly || connectionState === 'connected'
      ? 'text-[#615d59]'
      : connectionState === 'error'
        ? 'text-red-600'
        : 'text-[#dd5b00]'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e6e6e6] bg-white shadow-[rgba(0,0,0,0.01)_0_0.175px_1.041px,rgba(0,0,0,0.02)_0_0.8px_2.925px,rgba(0,0,0,0.027)_0_2.025px_7.847px,rgba(0,0,0,0.04)_0_4px_18px]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e6e6e6] px-3 py-1.5">
        <div className={`flex items-center gap-2 text-[12px] font-medium ${statusTone}`}>
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              readOnly
                ? 'bg-[#a39e98]'
                : connectionState === 'connected'
                  ? 'bg-[#1aae39]'
                  : connectionState === 'connecting'
                    ? 'animate-pulse bg-[#dd5b00]'
                    : connectionState === 'error'
                      ? 'bg-red-500'
                      : 'bg-[#a39e98]'
            }`}
            aria-hidden
          />
          <span>{connectionLabel(connectionState, readOnly)}</span>
        </div>
        {!readOnly ? <NoteOnlineUsers users={onlineUsers} className="mt-0" /> : null}
      </div>

      <div className="shrink-0">
        <NoteMarkdownEditorToolbar
          editor={editor}
          disabled={!canEdit || viewMode !== 'visual'}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          modeSwitchDisabled={!editor && !readOnly}
          beautifyDisabled={readOnly || !canEdit}
          onBeautifySource={() => {
            markdownDirtyRef.current = true
            setMarkdownApplyError(null)
            setMarkdownSource(beautifyNoteMarkdown(markdownSource))
          }}
          trailingActions={
            !readOnly ? (
              <NoteAiCommandControl
                noteId={noteId}
                contentType="markdown"
                disabled={!canEdit || Boolean(aiProposal)}
                reviewActive={Boolean(aiProposal)}
                getContent={() => {
                  if (viewMode === 'markdown') {
                    return markdownSource
                  }

                  return resolveCurrentMarkdown()
                }}
                onProposalReady={(proposal) => {
                  setAiProposal(proposal)
                  setAiDecisions(createPendingDecisions(proposal))
                }}
              />
            ) : null
          }
        />
      </div>

      {markdownApplyError ? (
        <div className="shrink-0 border-b border-[#e6e6e6] bg-[#f6f5f4] px-4 py-2 text-[12px] text-red-600">
          {markdownApplyError}
        </div>
      ) : null}

      <div
        className={`relative min-h-0 flex-1 ${
          aiProposal
            ? 'overflow-hidden'
            : viewMode === 'markdown'
              ? 'overflow-hidden'
              : `overflow-auto ${editorSurfaceClass}`
        }`}
      >
        {!readOnly && !isCollaborative ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-[15px] text-[#615d59]">
            جار تجهيز المحرر...
          </div>
        ) : null}

        {aiProposal ? (
          <NoteAiInlineDiff
            proposal={aiProposal}
            decisions={aiDecisions}
            onDecisionChange={(hunkId, decision) => {
              setAiDecisions((current) => ({ ...current, [hunkId]: decision }))
            }}
            onAcceptAll={() => {
              setAiDecisions(() => {
                const next = createPendingDecisions(aiProposal)
                for (const key of Object.keys(next)) {
                  next[key] = 'accepted'
                }
                return next
              })
            }}
            onRejectAll={() => {
              setAiDecisions(() => {
                const next = createPendingDecisions(aiProposal)
                for (const key of Object.keys(next)) {
                  next[key] = 'rejected'
                }
                return next
              })
            }}
            onApply={(content) => {
              if (!editor || !canEdit) {
                return
              }

              const normalized = normalizeNoteMarkdownInput(content).trim()
              const html = markdownToHtml(normalized)
              editor.commands.setContent(html, true)

              if (yText && yDoc) {
                applyingLocalRef.current = true
                yDoc.transact(() => {
                  replaceYTextContent(yText, normalized)
                })
                applyingLocalRef.current = false
              }

              markdownDirtyRef.current = false
              setMarkdownSource(formatNoteMarkdownForEditing(normalized))
              setMarkdownApplyError(null)
              setViewMode('visual')
              setAiProposal(null)
              setAiDecisions({})
            }}
            onDiscard={() => {
              setAiProposal(null)
              setAiDecisions({})
            }}
          />
        ) : viewMode === 'markdown' ? (
          <NoteMarkdownCodeEditor
            value={markdownSource}
            readOnly={readOnly || !canEdit}
            onChange={(nextValue) => {
              markdownDirtyRef.current = true
              setMarkdownApplyError(null)
              setMarkdownSource(nextValue)
            }}
          />
        ) : (
          <EditorContent editor={editor} className="min-h-full" />
        )}
      </div>
    </div>
  )
}
