import type { AppBindings, VectorizeVectorLike } from '../types/bindings'
import { NOTE_MAX_CHUNKS_PER_NOTE, chunkNoteText } from './note-chunking'
import { embedTexts, hashNoteContent } from './note-embeddings.service'

const TITLE_METADATA_MAX = 120
const CHUNK_METADATA_MAX = 1800

export interface TaskEmbedSubtask {
  name: string
  status: string
}

export interface TaskReindexInput {
  projectId: string
  taskId: string
  name: string
  description?: string | null
  status: string
  priority: string
  assignedTo?: string | null
  dueDate?: string | null
  points: number
  subtasks?: TaskEmbedSubtask[]
  /** When set, skip embed/upsert if content has not changed. */
  previousContentHash?: string | null
}

export interface TaskReindexResult {
  skipped: boolean
  contentHash: string
  chunkCount: number
}

function truncateMetadata(value: string, max: number) {
  if (value.length <= max) {
    return value
  }

  return `${value.slice(0, max - 1)}…`
}

export function taskToPlainText(
  task: Omit<TaskReindexInput, 'previousContentHash'>,
  subtasks: TaskEmbedSubtask[] = [],
) {
  const lines = [
    `Task: ${task.name.trim() || task.taskId}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Assigned to: ${task.assignedTo?.trim() || 'unassigned'}`,
    `Due: ${task.dueDate?.trim() || 'none'}`,
    `Points: ${task.points}`,
    'Description:',
    task.description?.trim() || '(none)',
  ]

  if (subtasks.length > 0) {
    lines.push('', 'Subtasks:')
    for (const subtask of subtasks) {
      const marker = subtask.status === 'completed' ? 'done' : 'open'
      lines.push(`- [${marker}] ${subtask.name.trim() || '(unnamed)'}`)
    }
  }

  return lines.join('\n').trim()
}

export function vectorIdForTaskChunk(taskId: string, chunkIndex: number) {
  return `task:${taskId}:${chunkIndex}`
}

export function allPossibleVectorIdsForTask(taskId: string) {
  return Array.from({ length: NOTE_MAX_CHUNKS_PER_NOTE }, (_, index) =>
    vectorIdForTaskChunk(taskId, index),
  )
}

export async function deleteTaskVectors(env: AppBindings, taskId: string) {
  const vectorize = env.VMS_NOTES_VECTORIZE
  if (!vectorize || !taskId.trim()) {
    return
  }

  await vectorize.deleteByIds(allPossibleVectorIdsForTask(taskId.trim()))
}

/**
 * Re-chunk, embed, and upsert a task into the shared project Vectorize index.
 * Soft-skips when bindings are missing. Throws on embed/upsert failures so callers can log.
 */
export async function reindexTaskVectors(
  env: AppBindings,
  input: TaskReindexInput,
): Promise<TaskReindexResult> {
  const subtasks = input.subtasks ?? []
  const plainText = taskToPlainText(input, subtasks)
  const contentHash = await hashNoteContent(plainText)

  if (input.previousContentHash && input.previousContentHash === contentHash) {
    return { skipped: true, contentHash, chunkCount: 0 }
  }

  const vectorize = env.VMS_NOTES_VECTORIZE
  const ai = env.AI
  if (!vectorize || !ai) {
    return { skipped: true, contentHash, chunkCount: 0 }
  }

  const chunks = chunkNoteText(plainText)

  await deleteTaskVectors(env, input.taskId)

  if (chunks.length === 0) {
    return { skipped: false, contentHash, chunkCount: 0 }
  }

  const embeddings = await embedTexts(ai, chunks)
  const title = truncateMetadata(input.name.trim() || input.taskId, TITLE_METADATA_MAX)
  const vectors: VectorizeVectorLike[] = chunks.map((chunk, index) => ({
    id: vectorIdForTaskChunk(input.taskId, index),
    values: embeddings[index]!,
    metadata: {
      kind: 'task',
      projectId: input.projectId,
      taskId: input.taskId,
      title,
      status: input.status,
      chunkIndex: index,
      text: truncateMetadata(chunk, CHUNK_METADATA_MAX),
    },
  }))

  await vectorize.upsert(vectors)
  return { skipped: false, contentHash, chunkCount: chunks.length }
}
