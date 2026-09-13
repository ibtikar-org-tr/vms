import { diffLines } from 'diff'

export type DiffHunkDecision = 'pending' | 'accepted' | 'rejected'

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

function joinChangeLines(lines: string[]) {
  return lines.join('')
}

/** Build unified line-diff segments (unchanged runs + change hunks). */
export function buildNoteDiffSegments(original: string, proposed: string): NoteDiffSegment[] {
  const parts = diffLines(normalizeLineEndings(original), normalizeLineEndings(proposed))
  const segments: NoteDiffSegment[] = []
  let hunkIndex = 0
  let index = 0

  while (index < parts.length) {
    const part = parts[index]!

    if (!part.added && !part.removed) {
      segments.push({ type: 'unchanged', text: part.value })
      index += 1
      continue
    }

    const removedLines: string[] = []
    const addedLines: string[] = []

    while (index < parts.length) {
      const current = parts[index]!
      if (!current.added && !current.removed) {
        break
      }
      if (current.removed) {
        removedLines.push(current.value)
      } else if (current.added) {
        addedLines.push(current.value)
      }
      index += 1
    }

    segments.push({
      type: 'hunk',
      hunk: {
        id: `hunk-${hunkIndex}`,
        oldText: joinChangeLines(removedLines),
        newText: joinChangeLines(addedLines),
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
) {
  return segments
    .map((segment) => {
      if (segment.type === 'unchanged') {
        return segment.text
      }

      const decision = decisions[segment.hunk.id] ?? 'pending'
      if (decision === 'accepted') {
        return segment.hunk.newText
      }

      return segment.hunk.oldText
    })
    .join('')
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
