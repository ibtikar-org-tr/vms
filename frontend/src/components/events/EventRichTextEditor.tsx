import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold } from 'lucide-react'
import { eventRichTextForEditor, isEventRichTextEmpty } from '../../utils/event-rich-text'

const editorSurfaceClass =
  '[&_.ProseMirror]:min-h-36 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2.5 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-7 [&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p:last-child]:mb-0 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_b]:font-semibold [&_.ProseMirror_.is-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-empty:first-child::before]:float-right [&_.ProseMirror_.is-empty:first-child::before]:h-0 [&_.ProseMirror_.is-empty:first-child::before]:text-slate-400 [&_.ProseMirror_.is-empty:first-child::before]:content-[attr(data-placeholder)]'

export function EventRichTextEditor({
  value,
  onChange,
  placeholder,
  minHeightClassName = 'min-h-36',
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeightClassName?: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
        strike: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
    ],
    content: eventRichTextForEditor(value) || '<p></p>',
    editorProps: {
      attributes: {
        class: minHeightClassName,
        dir: 'rtl',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      onChange(isEventRichTextEmpty(html) ? '' : html)
    },
  })

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return
    }

    const next = eventRichTextForEditor(value) || '<p></p>'
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, false)
    }
  }, [editor, value])

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 ${editorSurfaceClass}`}>
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
            editor?.isActive('bold') ? 'bg-cyan-100 text-cyan-800' : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Bold className="h-3.5 w-3.5" />
          خط سميك
        </button>
        <span className="mr-auto text-[11px] text-slate-500">Enter لسطر جديد</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
