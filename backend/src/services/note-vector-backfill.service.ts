import { listProjectNotes } from '../repositories/vms-project-notes.repository'
import type { AppBindings } from '../types/bindings'
import { reindexNoteVectors } from './note-embeddings.service'

export interface ReindexProjectNotesResult {
  total: number
  indexed: number
  skipped: number
  failed: number
  errors: Array<{ noteId: string; message: string }>
}

/**
 * One-shot backfill: embed all notes for a project (or every note if projectId omitted).
 */
export async function reindexAllProjectNotes(
  env: AppBindings,
  options?: { projectId?: string; limit?: number },
): Promise<ReindexProjectNotesResult> {
  const notes = await listProjectNotes(env.VMS_DB, options?.projectId)
  const limited = typeof options?.limit === 'number' ? notes.slice(0, options.limit) : notes

  const result: ReindexProjectNotesResult = {
    total: limited.length,
    indexed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  for (const note of limited) {
    try {
      const reindex = await reindexNoteVectors(env, {
        projectId: note.projectId,
        noteId: note.id,
        title: note.title,
        contentType: note.contentType,
        content: note.content,
      })

      if (reindex.skipped) {
        result.skipped += 1
      } else {
        result.indexed += 1
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({
        noteId: note.id,
        message: error instanceof Error ? error.message : 'Unknown reindex error',
      })
      console.warn(`Backfill reindex failed for note ${note.id}`, error)
    }
  }

  return result
}
