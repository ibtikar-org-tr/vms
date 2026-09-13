import type { ProjectNoteContentType } from '../schemas/vms-project-note.schema'

export const NOTE_CHUNK_TARGET_CHARS = 1000
export const NOTE_CHUNK_OVERLAP_CHARS = 150
export const NOTE_MAX_CHUNKS_PER_NOTE = 40

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function noteContentToPlainText(content: string, contentType: ProjectNoteContentType) {
  if (contentType === 'markdown') {
    return content.trim()
  }

  return stripHtmlToText(content)
}

function findBreakIndex(text: string, from: number, to: number) {
  const window = text.slice(from, to)
  const paragraphBreak = window.lastIndexOf('\n\n')
  if (paragraphBreak >= Math.floor(window.length * 0.4)) {
    return from + paragraphBreak + 2
  }

  const lineBreak = window.lastIndexOf('\n')
  if (lineBreak >= Math.floor(window.length * 0.4)) {
    return from + lineBreak + 1
  }

  const sentenceBreak = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('。'),
    window.lastIndexOf('؟ '),
    window.lastIndexOf('! '),
  )
  if (sentenceBreak >= Math.floor(window.length * 0.4)) {
    return from + sentenceBreak + 2
  }

  const spaceBreak = window.lastIndexOf(' ')
  if (spaceBreak >= Math.floor(window.length * 0.4)) {
    return from + spaceBreak + 1
  }

  return to
}

/** Split plain note text into overlapping chunks for embedding. */
export function chunkNoteText(plainText: string): string[] {
  const text = plainText.trim()
  if (!text) {
    return []
  }

  if (text.length <= NOTE_CHUNK_TARGET_CHARS) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length && chunks.length < NOTE_MAX_CHUNKS_PER_NOTE) {
    const softEnd = Math.min(start + NOTE_CHUNK_TARGET_CHARS, text.length)
    const end = softEnd >= text.length ? text.length : findBreakIndex(text, start, softEnd)
    const chunk = text.slice(start, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    if (end >= text.length) {
      break
    }

    start = Math.max(end - NOTE_CHUNK_OVERLAP_CHARS, start + 1)
  }

  return chunks
}

export function vectorIdForNoteChunk(noteId: string, chunkIndex: number) {
  return `${noteId}:${chunkIndex}`
}

export function allPossibleVectorIdsForNote(noteId: string) {
  return Array.from({ length: NOTE_MAX_CHUNKS_PER_NOTE }, (_, index) =>
    vectorIdForNoteChunk(noteId, index),
  )
}
