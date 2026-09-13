import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import type * as awarenessProtocol from 'y-protocols/awareness'
import type * as Y from 'yjs'
import { plainTextToHtml, xmlFragmentToPlainText } from '../../../utils/yjs-rich-text'
import { NoteEditorToolbar, type NoteEditorViewMode } from './NoteEditorToolbar'
import { formatNoteHtmlForEditing, beautifyNoteHtml, normalizeNoteHtmlInput } from './note-html-source'
import { NoteAiCommandControl, createPendingDecisions } from './NoteAiCommandControl'
import { NoteAiInlineDiff, type NoteAiProposal } from './NoteAiInlineDiff'
import type { DiffHunkDecision } from './note-ai-diff'
import { NoteFontSize } from './note-font-size'
import { NoteHtmlCodeEditor } from './NoteHtmlCodeEditor'
import { NoteOnlineUsers, type ResolvedOnlineUser } from './NoteOnlineUsers'
import { NoteTextDirection } from './note-text-direction'
import { createNoteMemberMention } from './note-member-mention'
import type { MentionableMember } from './mentionable-members'
import { RemoteCursorEdgeIndicators } from './RemoteCursorEdgeIndicators'

interface CollaborativeNoteEditorProps {
  noteId: string
  yDoc: Y.Doc | null
  awareness: awarenessProtocol.Awareness | null
  initialContent?: string
  readOnly?: boolean
  connectionState: 'idle' | 'connecting' | 'connected' | 'error'
  /** True after the first Yjs sync step-2 from the room — required before SQL seeding. */
  isSynced?: boolean
  onlineUsers: ResolvedOnlineUser[]
  memberColor: string
  displayName: string
  membershipNumber: string
  mentionableMembers: MentionableMember[]
}

const editorSurfaceClass =
  'h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:px-5 [&_.ProseMirror]:py-5 [&_.ProseMirror]:text-[16px] [&_.ProseMirror]:leading-[1.5] [&_.ProseMirror]:text-black [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h1]:my-3 [&_.ProseMirror_h1]:text-[40px] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:tracking-[-1px] [&_.ProseMirror_h2]:my-2.5 [&_.ProseMirror_h2]:text-[26px] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:tracking-[-0.625px] [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_h3]:text-[22px] [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:tracking-[-0.25px] [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-6 [&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-s-4 [&_.ProseMirror_blockquote]:border-[#e6e6e6] [&_.ProseMirror_blockquote]:ps-4 [&_.ProseMirror_blockquote]:text-[#615d59] [&_.ProseMirror_a]:text-[#0075de] [&_.ProseMirror_.is-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-empty:first-child::before]:float-left [&_.ProseMirror_.is-empty:first-child::before]:h-0 [&_.ProseMirror_.is-empty:first-child::before]:text-[#a39e98] [&_.ProseMirror_.is-empty:first-child::before]:content-[attr(data-placeholder)]'

function connectionLabel(connectionState: CollaborativeNoteEditorProps['connectionState'], readOnly: boolean) {
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

export function CollaborativeNoteEditor({
  noteId,
  yDoc,
  awareness,
  initialContent = '',
  readOnly = false,
  connectionState,
  isSynced = false,
  onlineUsers,
  memberColor,
  displayName,
  membershipNumber,
  mentionableMembers,
}: CollaborativeNoteEditorProps) {
  const hasSeededRef = useRef(false)
  const seedNoteIdRef = useRef<string | null>(null)
  const mentionableMembersRef = useRef(mentionableMembers)
  const htmlDirtyRef = useRef(false)
  const editorScrollRef = useRef<HTMLDivElement | null>(null)
  const [viewMode, setViewMode] = useState<NoteEditorViewMode>('visual')
  const [htmlSource, setHtmlSource] = useState('')
  const [htmlApplyError, setHtmlApplyError] = useState<string | null>(null)
  const [aiProposal, setAiProposal] = useState<NoteAiProposal | null>(null)
  const [aiDecisions, setAiDecisions] = useState<Record<string, DiffHunkDecision>>({})

  mentionableMembersRef.current = mentionableMembers

  const memberMentionExtension = useMemo(
    () => createNoteMemberMention(() => mentionableMembersRef.current),
    [],
  )

  const isCollaborative = Boolean(yDoc && awareness && !readOnly)
  // Keep editing available while reconnecting so a dropped socket cannot freeze the UI.
  const canEdit = isCollaborative

  const staticContent = useMemo(() => plainTextToHtml(initialContent), [initialContent])

  const editor = useEditor(
    {
      editable: isCollaborative,
      extensions: isCollaborative
        ? [
            StarterKit.configure({
              history: false,
            }),
            Underline,
            NoteFontSize,
            NoteTextDirection,
            memberMentionExtension,
            Placeholder.configure({
              placeholder: 'ابدأ الكتابة... اكتب @ للإشارة إلى عضو في المشروع.',
            }),
            Collaboration.configure({
              document: yDoc!,
            }),
            CollaborationCursor.configure({
              provider: {
                awareness: awareness!,
              },
              user: {
                name: displayName,
                color: memberColor,
              },
            }),
          ]
        : [
            StarterKit,
            Underline,
            NoteFontSize,
            NoteTextDirection,
            memberMentionExtension,
            Placeholder.configure({
              placeholder: readOnly ? 'يمكنك مشاهدة هذه الملاحظة فقط.' : 'جار تحميل المحرر...',
            }),
          ],
      content: readOnly ? staticContent : undefined,
      editorProps: {
        attributes: {
          class: 'note-rich-text',
          dir: 'auto',
        },
      },
    },
    // Intentionally omit connectionState — remounting on reconnect orphaned Tippy overlays and froze clicks.
    [noteId, readOnly, isCollaborative, yDoc, awareness, memberColor, displayName],
  )

  useEffect(() => {
    if (seedNoteIdRef.current !== noteId) {
      seedNoteIdRef.current = noteId
      hasSeededRef.current = false
      setViewMode('visual')
      setHtmlSource('')
      setHtmlApplyError(null)
      htmlDirtyRef.current = false
      setAiProposal(null)
      setAiDecisions({})
    }
  }, [noteId])

  useEffect(() => {
    // Never seed from SQL until Yjs sync finished — otherwise we insert REST HTML into an
    // empty local doc, then merge the real room state and permanently duplicate content (2^n).
    if (!editor || !yDoc || readOnly || !isSynced || hasSeededRef.current) {
      return
    }

    const fragment = yDoc.getXmlFragment('default')
    // TipTap may leave an empty <paragraph>; treat "has visible text" as already seeded.
    if (xmlFragmentToPlainText(fragment).trim().length > 0) {
      hasSeededRef.current = true
      return
    }

    if (!initialContent.trim()) {
      hasSeededRef.current = true
      return
    }

    editor.commands.setContent(plainTextToHtml(initialContent), false)
    hasSeededRef.current = true
  }, [editor, initialContent, isSynced, readOnly, yDoc])

  useEffect(() => {
    if (!editor) {
      return
    }

    // Avoid remote caret churn into the HTML textarea while the user is editing source.
    editor.setEditable(canEdit && viewMode === 'visual')
  }, [canEdit, editor, viewMode])

  useEffect(() => {
    if (!editor || !readOnly) {
      return
    }

    editor.commands.setContent(staticContent, false)
  }, [editor, readOnly, staticContent])

  useEffect(() => {
    if (!editor || !awareness || readOnly) {
      return
    }

    awareness.setLocalStateField('notePresence', {
      membershipNumber,
      displayName,
    })
  }, [awareness, displayName, editor, membershipNumber, readOnly])

  useEffect(() => {
    return () => {
      // Safety net: destroy any leftover Tippy layers if the suggestion onExit raced a remount.
      document.querySelectorAll('[data-tippy-root]').forEach((node) => {
        node.remove()
      })
    }
  }, [noteId])

  // Keep the HTML pane in sync with collaborative visual edits until the user edits the source.
  useEffect(() => {
    if (!editor || viewMode !== 'html' || htmlDirtyRef.current) {
      return
    }

    const syncHtmlFromEditor = () => {
      if (htmlDirtyRef.current) {
        return
      }

      setHtmlSource(formatNoteHtmlForEditing(editor.getHTML()))
    }

    syncHtmlFromEditor()
    editor.on('update', syncHtmlFromEditor)

    return () => {
      editor.off('update', syncHtmlFromEditor)
    }
  }, [editor, viewMode])

  const resolveCurrentHtml = () => {
    if (editor) {
      return formatNoteHtmlForEditing(editor.getHTML())
    }

    if (readOnly) {
      return formatNoteHtmlForEditing(staticContent)
    }

    return formatNoteHtmlForEditing(plainTextToHtml(initialContent))
  }

  const handleViewModeChange = (nextMode: NoteEditorViewMode) => {
    if (nextMode === viewMode) {
      return
    }

    setHtmlApplyError(null)

    if (nextMode === 'html') {
      htmlDirtyRef.current = false
      setHtmlSource(resolveCurrentHtml())
      setViewMode('html')
      return
    }

    // Apply HTML → visual (and into Yjs when collaborative).
    if (!editor) {
      setViewMode('visual')
      return
    }

    if (readOnly || !canEdit) {
      htmlDirtyRef.current = false
      setViewMode('visual')
      return
    }

    try {
      const normalized = normalizeNoteHtmlInput(htmlSource)
      const applied = editor.commands.setContent(normalized, true)

      if (!applied) {
        setHtmlApplyError('تعذر تطبيق HTML. تحقق من صحة الوسوم ثم حاول مرة أخرى.')
        return
      }

      htmlDirtyRef.current = false
      setHtmlSource(formatNoteHtmlForEditing(editor.getHTML()))
      setViewMode('visual')
    } catch {
      setHtmlApplyError('تعذر تطبيق HTML. تحقق من صحة الوسوم ثم حاول مرة أخرى.')
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
      <style>{`
        .note-rich-text .collaboration-cursor__caret {
          position: relative;
          margin-inline: -1px;
          border-inline-start-width: 2px;
          border-inline-start-style: solid;
          pointer-events: none;
        }
        .note-rich-text .collaboration-cursor__label {
          position: absolute;
          top: -1.35em;
          inset-inline-start: -1px;
          padding: 2px 6px;
          border-radius: 4px 4px 4px 0;
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
          color: #fff;
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        }
        .note-rich-text .note-mention {
          display: inline-flex;
          align-items: center;
          border-radius: 9999px;
          border: 1px solid #e6e6e6;
          background: #f6f5f4;
          padding: 0 0.45rem;
          font-size: 0.875em;
          font-weight: 600;
          color: #31302e;
          white-space: nowrap;
        }
        .tippy-box {
          background: transparent;
          color: inherit;
          font-size: inherit;
          line-height: inherit;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
        .tippy-content {
          padding: 0;
        }
        .tippy-box[data-placement^='top'] > .tippy-arrow,
        .tippy-box[data-placement^='bottom'] > .tippy-arrow {
          display: none;
        }
      `}</style>

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
        <NoteEditorToolbar
          editor={editor}
          disabled={!canEdit || viewMode !== 'visual'}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          modeSwitchDisabled={!editor && !readOnly}
          beautifyDisabled={readOnly || !canEdit}
          onBeautifySource={() => {
            htmlDirtyRef.current = true
            setHtmlApplyError(null)
            setHtmlSource(beautifyNoteHtml(htmlSource))
          }}
          trailingActions={
            !readOnly ? (
              <NoteAiCommandControl
                noteId={noteId}
                contentType="html"
                disabled={!canEdit || Boolean(aiProposal)}
                reviewActive={Boolean(aiProposal)}
                getContent={() => {
                  if (viewMode === 'html') {
                    return htmlSource
                  }

                  if (editor) {
                    return editor.getHTML()
                  }

                  return resolveCurrentHtml()
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

      {htmlApplyError ? (
        <div className="shrink-0 border-b border-[#e6e6e6] bg-[#f6f5f4] px-4 py-2 text-[12px] text-red-600">{htmlApplyError}</div>
      ) : null}

      <div className="relative min-h-0 flex-1">
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

              const normalized = normalizeNoteHtmlInput(content)
              editor.commands.setContent(normalized, true)
              htmlDirtyRef.current = false
              setHtmlSource(formatNoteHtmlForEditing(editor.getHTML()))
              setHtmlApplyError(null)
              setViewMode('visual')
              setAiProposal(null)
              setAiDecisions({})
            }}
            onDiscard={() => {
              setAiProposal(null)
              setAiDecisions({})
            }}
          />
        ) : (
          <>
            {viewMode === 'visual' ? (
              <RemoteCursorEdgeIndicators
                editor={editor}
                scrollContainerRef={editorScrollRef}
                enabled={canEdit}
              />
            ) : null}

            <div
              ref={editorScrollRef}
              className={`h-full min-h-0 ${
                viewMode === 'html' ? 'overflow-hidden' : `overflow-auto ${editorSurfaceClass}`
              }`}
            >
              {viewMode === 'html' ? (
                <NoteHtmlCodeEditor
                  value={htmlSource}
                  readOnly={readOnly || !canEdit}
                  onChange={(nextValue) => {
                    htmlDirtyRef.current = true
                    setHtmlApplyError(null)
                    setHtmlSource(nextValue)
                  }}
                />
              ) : (
                <EditorContent editor={editor} className="min-h-full" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
