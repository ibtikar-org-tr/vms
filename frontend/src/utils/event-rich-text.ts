const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'UL', 'OL', 'LI'])

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function eventPlainTextToHtml(value: string) {
  const trimmed = value.replace(/\r\n/g, '\n').trim()
  if (!trimmed) {
    return ''
  }

  const escaped = escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function eventRichTextToPlain(html: string) {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isEventRichTextEmpty(html: string | null | undefined) {
  return !eventRichTextToPlain(html ?? '')
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value)
}

export function sanitizeEventRichText(html: string | null | undefined) {
  const raw = (html ?? '').trim()
  if (!raw) {
    return ''
  }

  if (!looksLikeHtml(raw)) {
    return eventPlainTextToHtml(raw)
  }

  if (typeof DOMParser === 'undefined') {
    return eventPlainTextToHtml(eventRichTextToPlain(raw))
  }

  const parsed = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  const root = parsed.body.firstElementChild
  if (!root) {
    return ''
  }

  const clean = (node: Element) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element
        if (!ALLOWED_TAGS.has(element.tagName)) {
          while (element.firstChild) {
            node.insertBefore(element.firstChild, element)
          }
          node.removeChild(element)
          continue
        }

        while (element.attributes.length > 0) {
          element.removeAttribute(element.attributes[0].name)
        }
        clean(element)
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child)
      }
    }
  }

  clean(root)
  return root.innerHTML.trim()
}

export function eventRichTextForEditor(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) {
    return ''
  }

  return looksLikeHtml(raw) ? sanitizeEventRichText(raw) : eventPlainTextToHtml(raw)
}
