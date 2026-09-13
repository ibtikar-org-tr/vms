import { diffArrays } from 'diff'

export type DiffHunkDecision = 'pending' | 'accepted' | 'rejected'
export type NoteDiffContentType = 'html' | 'markdown'

export interface NoteDiffHunk {
  id: string
  oldText: string
  newText: string
}

export type NoteDiffSegment =
  | { type: 'unchanged'; text: string }
  | { type: 'hunk'; hunk: NoteDiffHunk }

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n')
}

/** Split note content into semantic blocks for diff + rich preview. */
export function splitNoteBlocks(content: string, contentType: NoteDiffContentType): string[] {
  const normalized = normalizeLineEndings(content).trim()
  if (!normalized) {
    return []
  }

  if (contentType === 'markdown') {
    return normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
  }

  if (typeof DOMParser === 'undefined') {
    return normalized
      .split(/\n+/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
  }

  const doc = new DOMParser().parseFromString(`<div id="note-ai-root">${normalized}</div>`, 'text/html')
  const root = doc.getElementById('note-ai-root')
  if (!root) {
    return [normalized]
  }

  const blocks: string[] = []
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const html = (node as Element).outerHTML.trim()
      if (html) {
        blocks.push(html)
      }
      continue
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        blocks.push(text)
      }
    }
  }

  return blocks.length > 0 ? blocks : [normalized]
}

function joinNoteBlocks(blocks: string[], contentType: NoteDiffContentType) {
  if (blocks.length === 0) {
    return ''
  }

  if (contentType === 'markdown') {
    return blocks.join('\n\n')
  }

  return blocks.join('')
}

/** Build block-level diff segments (no blank spacer rows between blocks). */
export function buildNoteDiffSegments(
  original: string,
  proposed: string,
  contentType: NoteDiffContentType = 'html',
): NoteDiffSegment[] {
  const originalBlocks = splitNoteBlocks(original, contentType)
  const proposedBlocks = splitNoteBlocks(proposed, contentType)
  const parts = diffArrays(originalBlocks, proposedBlocks)
  const segments: NoteDiffSegment[] = []
  let hunkIndex = 0
  let index = 0

  while (index < parts.length) {
    const part = parts[index]!

    if (!part.added && !part.removed) {
      const text = joinNoteBlocks(part.value, contentType)
      if (text) {
        segments.push({ type: 'unchanged', text })
      }
      index += 1
      continue
    }

    const removed: string[] = []
    const added: string[] = []

    while (index < parts.length) {
      const current = parts[index]!
      if (!current.added && !current.removed) {
        break
      }
      if (current.removed) {
        removed.push(...current.value)
      } else if (current.added) {
        added.push(...current.value)
      }
      index += 1
    }

    const oldText = joinNoteBlocks(removed, contentType)
    const newText = joinNoteBlocks(added, contentType)
    if (!oldText && !newText) {
      continue
    }

    segments.push({
      type: 'hunk',
      hunk: {
        id: `hunk-${hunkIndex}`,
        oldText,
        newText,
      },
    })
    hunkIndex += 1
  }

  return segments
}

export function listDiffHunks(segments: NoteDiffSegment[]) {
  return segments.flatMap((segment) => (segment.type === 'hunk' ? [segment.hunk] : []))
}

/** Compose final note text from hunk decisions (pending treated as rejected). */
export function composeNoteFromDiffDecisions(
  segments: NoteDiffSegment[],
  decisions: Record<string, DiffHunkDecision>,
  contentType: NoteDiffContentType = 'html',
) {
  const pieces: string[] = []

  for (const segment of segments) {
    if (segment.type === 'unchanged') {
      if (segment.text) {
        pieces.push(segment.text)
      }
      continue
    }

    const decision = decisions[segment.hunk.id] ?? 'pending'
    const text = decision === 'accepted' ? segment.hunk.newText : segment.hunk.oldText
    if (text) {
      pieces.push(text)
    }
  }

  return joinNoteBlocks(pieces, contentType)
}

export function countHunkDecisions(
  hunks: NoteDiffHunk[],
  decisions: Record<string, DiffHunkDecision>,
) {
  let accepted = 0
  let rejected = 0
  let pending = 0

  for (const hunk of hunks) {
    const decision = decisions[hunk.id] ?? 'pending'
    if (decision === 'accepted') {
      accepted += 1
    } else if (decision === 'rejected') {
      rejected += 1
    } else {
      pending += 1
    }
  }

  return { accepted, rejected, pending }
}

/** True when a block has no visible text (ignore empty tags / whitespace). */
export function isVisuallyEmptyBlock(htmlOrMarkdown: string, contentType: NoteDiffContentType) {
  const raw = htmlOrMarkdown.trim()
  if (!raw) {
    return true
  }

  if (contentType === 'markdown') {
    return raw.replace(/[#>*_\-`\s]/g, '').length === 0 && !raw.includes('![')
  }

  const text = raw
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()

  return text.length === 0 && !/<img\b/i.test(raw)
}
