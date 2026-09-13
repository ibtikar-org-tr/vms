import { listProjectNotes } from '../repositories/vms-project-notes.repository'
import type { AppBindings, VectorizeMetadataValue } from '../types/bindings'
import { embedQueryText } from './note-embeddings.service'

const RAG_TOP_K = 6
const RAG_CONTEXT_MAX_CHARS = 6_000
const RAG_ROSTER_MAX_CHARS = 2_000
const RAG_MIN_SCORE = 0.25

export interface NoteRagContext {
  relatedNotesBlock: string
  rosterBlock: string
}

function metadataString(
  metadata: Record<string, VectorizeMetadataValue> | undefined,
  key: string,
): string {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : ''
}

function metadataNumber(
  metadata: Record<string, VectorizeMetadataValue> | undefined,
  key: string,
): number | null {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatRelatedMatches(
  matches: Array<{ id: string; score: number; metadata?: Record<string, VectorizeMetadataValue> }>,
) {
  const parts: string[] = []
  let used = 0

  for (const match of matches) {
    if (match.score < RAG_MIN_SCORE) {
      continue
    }

    const title = metadataString(match.metadata, 'title') || 'Untitled'
    const noteId = metadataString(match.metadata, 'noteId') || match.id
    const text = metadataString(match.metadata, 'text').trim()
    if (!text) {
      continue
    }

    const chunkIndex = metadataNumber(match.metadata, 'chunkIndex')
    const header =
      chunkIndex == null ? `[${title}] (${noteId})` : `[${title}] (${noteId} #${chunkIndex})`
    const block = `${header}\n${text}`
    if (used + block.length + 5 > RAG_CONTEXT_MAX_CHARS) {
      break
    }

    parts.push(block)
    used += block.length + 5
  }

  if (parts.length === 0) {
    return ''
  }

  return `Related project notes (retrieved by similarity — use only if relevant to the command):\n---\n${parts.join('\n---\n')}\n---`
}

function formatNoteRoster(
  notes: Array<{ id: string; title: string }>,
  excludeNoteId: string,
) {
  const lines: string[] = []
  let used = 'Project notes roster:\n'.length

  for (const note of notes) {
    if (note.id === excludeNoteId) {
      continue
    }

    const line = `- ${note.title.trim() || note.id} (${note.id})`
    if (used + line.length + 1 > RAG_ROSTER_MAX_CHARS) {
      break
    }

    lines.push(line)
    used += line.length + 1
  }

  if (lines.length === 0) {
    return ''
  }

  return `Project notes roster:\n${lines.join('\n')}`
}

/**
 * Build RAG context for AI note edit. Soft-fails to empty blocks when Vectorize/AI are unavailable.
 */
export async function buildNoteRagContext(
  env: AppBindings,
  input: {
    projectId: string
    noteId: string
    command: string
    noteTitle?: string | null
  },
): Promise<NoteRagContext> {
  const empty: NoteRagContext = { relatedNotesBlock: '', rosterBlock: '' }

  try {
    const notes = await listProjectNotes(env.VMS_DB, input.projectId)
    const rosterBlock = formatNoteRoster(
      notes.map((note) => ({ id: note.id, title: note.title })),
      input.noteId,
    )

    const vectorize = env.VMS_NOTES_VECTORIZE
    if (!vectorize) {
      return { relatedNotesBlock: '', rosterBlock }
    }

    const queryText = [input.noteTitle?.trim(), input.command.trim()].filter(Boolean).join('\n')
    const queryVector = await embedQueryText(env, queryText)
    if (!queryVector) {
      return { relatedNotesBlock: '', rosterBlock }
    }

    const result = await vectorize.query(queryVector, {
      topK: RAG_TOP_K,
      returnMetadata: 'all',
      filter: {
        projectId: { $eq: input.projectId },
        noteId: { $ne: input.noteId },
      },
    })

    const relatedNotesBlock = formatRelatedMatches(result.matches ?? [])
    return { relatedNotesBlock, rosterBlock }
  } catch (error) {
    console.warn('Note RAG context retrieval failed; continuing without vector context', error)
    return empty
  }
}
