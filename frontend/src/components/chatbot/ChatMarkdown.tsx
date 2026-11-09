import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

function renderMarkdown(markdown: string) {
  const trimmed = markdown.trim()
  if (!trimmed) {
    return ''
  }

  const html = marked.parse(trimmed, { async: false })
  return typeof html === 'string' ? html : ''
}

export function ChatMarkdown({ content }: { content: string }) {
  const html = renderMarkdown(content)

  return (
    <div
      className="chat-md text-sm leading-6 text-inherit [&_a]:font-semibold [&_a]:text-teal-700 [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:my-1.5 [&_li]:leading-6 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
