import { listProjectNotes } from '../repositories/vms-project-notes.repository'
import { listTasksByProjectId } from '../repositories/vms-tasks.repository'
import type { AppBindings, VectorizeMetadataValue } from '../types/bindings'
import { embedQueryText } from './note-embeddings.service'

const RAG_TOP_K = 8
const RAG_CONTEXT_MAX_CHARS = 6_000
const RAG_ROSTER_MAX_CHARS = 2_000
const RAG_MIN_SCORE = 0.25

export interface ProjectRagContext {
  relatedContextBlock: string
  noteRosterBlock: string
  taskRosterBlock: string
}

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

function isTaskMatch(metadata: Record<string, VectorizeMetadataValue> | undefined) {
  const kind = metadataString(metadata, 'kind')
  if (kind === 'task') {
    return true
  }
  return Boolean(metadataString(metadata, 'taskId'))
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

    const text = metadataString(match.metadata, 'text').trim()
    if (!text) {
      continue
    }

    const title = metadataString(match.metadata, 'title') || 'Untitled'
    const chunkIndex = metadataNumber(match.metadata, 'chunkIndex')
    const taskMatch = isTaskMatch(match.metadata)

    let header: string
    if (taskMatch) {
      const taskId = metadataString(match.metadata, 'taskId') || match.id
      const status = metadataString(match.metadata, 'status')
      const statusSuffix = status ? ` [${status}]` : ''
      header =
        chunkIndex == null
          ? `[Task: ${title}]${statusSuffix} (${taskId})`
          : `[Task: ${title}]${statusSuffix} (${taskId} #${chunkIndex})`
    } else {
      const noteId = metadataString(match.metadata, 'noteId') || match.id
      header =
        chunkIndex == null ? `[${title}] (${noteId})` : `[${title}] (${noteId} #${chunkIndex})`
    }

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

  return `Related project context (retrieved by similarity — use only if relevant):\n---\n${parts.join('\n---\n')}\n---`
}

function formatNoteRoster(
  notes: Array<{ id: string; title: string }>,
  excludeNoteId?: string | null,
) {
  const lines: string[] = []
  let used = 'Project notes roster:\n'.length

  for (const note of notes) {
    if (excludeNoteId && note.id === excludeNoteId) {
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

function formatTaskRoster(tasks: Array<{ id: string; name: string; status: string }>) {
  const lines: string[] = []
  let used = 'Project tasks roster:\n'.length

  for (const task of tasks) {
    const line = `- ${task.name.trim() || task.id} [${task.status}] (${task.id})`
    if (used + line.length + 1 > RAG_ROSTER_MAX_CHARS) {
      break
    }

    lines.push(line)
    used += line.length + 1
  }

  if (lines.length === 0) {
    return ''
  }

  return `Project tasks roster:\n${lines.join('\n')}`
}

/**
 * Build project-scoped RAG context (notes roster, optional task roster, vector matches).
 * Soft-fails to empty blocks when Vectorize/AI are unavailable.
 */
export async function buildProjectRagContext(
  env: AppBindings,
  input: {
    projectId: string
    queryText: string
    excludeNoteId?: string | null
    includeTaskRoster?: boolean
  },
): Promise<ProjectRagContext> {
  const empty: ProjectRagContext = {
    relatedContextBlock: '',
    noteRosterBlock: '',
    taskRosterBlock: '',
  }

  try {
    const notes = await listProjectNotes(env.VMS_DB, input.projectId)
    const noteRosterBlock = formatNoteRoster(
      notes.map((note) => ({ id: note.id, title: note.title })),
      input.excludeNoteId,
    )

    let taskRosterBlock = ''
    if (input.includeTaskRoster) {
      const tasks = await listTasksByProjectId(env.VMS_DB, input.projectId)
      taskRosterBlock = formatTaskRoster(
        tasks.map((task) => ({ id: task.id, name: task.name, status: task.status })),
      )
    }

    const vectorize = env.VMS_NOTES_VECTORIZE
    if (!vectorize) {
      return { relatedContextBlock: '', noteRosterBlock, taskRosterBlock }
    }

    const queryVector = await embedQueryText(env, input.queryText.trim())
    if (!queryVector) {
      return { relatedContextBlock: '', noteRosterBlock, taskRosterBlock }
    }

    const result = await vectorize.query(queryVector, {
      topK: RAG_TOP_K,
      returnMetadata: 'all',
      filter: {
        projectId: { $eq: input.projectId },
      },
    })

    const matches = (result.matches ?? []).filter((match) => {
      if (!input.excludeNoteId) {
        return true
      }
      const noteId = metadataString(match.metadata, 'noteId')
      return noteId !== input.excludeNoteId
    })

    return {
      relatedContextBlock: formatRelatedMatches(matches),
      noteRosterBlock,
      taskRosterBlock,
    }
  } catch (error) {
    console.warn('Project RAG context retrieval failed; continuing without vector context', error)
    return empty
  }
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
  const queryText = [input.noteTitle?.trim(), input.command.trim()].filter(Boolean).join('\n')
  const rag = await buildProjectRagContext(env, {
    projectId: input.projectId,
    queryText,
    excludeNoteId: input.noteId,
  })

  return {
    relatedNotesBlock: rag.relatedContextBlock,
    rosterBlock: rag.noteRosterBlock,
  }
}
