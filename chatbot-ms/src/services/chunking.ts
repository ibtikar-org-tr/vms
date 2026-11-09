export const CHUNK_TARGET_CHARS = 1000
export const CHUNK_OVERLAP_CHARS = 150
export const MAX_CHUNKS_PER_DOC = 40

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

/** Split plain text into overlapping chunks for embedding. */
export function chunkText(plainText: string): string[] {
  const text = plainText.trim()
  if (!text) {
    return []
  }

  if (text.length <= CHUNK_TARGET_CHARS) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    const softEnd = Math.min(start + CHUNK_TARGET_CHARS, text.length)
    const end = softEnd >= text.length ? text.length : findBreakIndex(text, start, softEnd)
    const chunk = text.slice(start, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    if (end >= text.length) {
      break
    }

    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1)
  }

  return chunks
}

export function vectorIdForChunk(docId: string, chunkIndex: number) {
  return `${docId}:${chunkIndex}`
}

export function allPossibleVectorIdsForDoc(docId: string) {
  return Array.from({ length: MAX_CHUNKS_PER_DOC }, (_, index) =>
    vectorIdForChunk(docId, index),
  )
}
