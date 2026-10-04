import { isEventRichTextEmpty, sanitizeEventRichText } from '../../utils/event-rich-text'

export function EventRichText({
  value,
  className = '',
  emptyText,
}: {
  value: string | null | undefined
  className?: string
  emptyText?: string
}) {
  const html = sanitizeEventRichText(value)

  if (!html || isEventRichTextEmpty(html)) {
    return emptyText ? <p className={className}>{emptyText}</p> : null
  }

  return (
    <div
      className={`event-rich-text max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_b]:font-semibold [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:mb-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
