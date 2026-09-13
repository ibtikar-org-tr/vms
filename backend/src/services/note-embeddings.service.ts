import type { ProjectNoteContentType } from '../schemas/vms-project-note.schema'
import type { AppBindings, CloudflareAiBindingLike, VectorizeVectorLike } from '../types/bindings'
import {
  allPossibleVectorIdsForNote,
  chunkNoteText,
  noteContentToPlainText,
  vectorIdForNoteChunk,
} from './note-chunking'

export const NOTE_EMBEDDING_MODEL = '@cf/baai/bge-m3'

const TITLE_METADATA_MAX = 120
const CHUNK_METADATA_MAX = 1800
const EMBED_BATCH_SIZE = 8

export interface NoteReindexInput {
  projectId: string
  noteId: string
  title: string
  contentType: ProjectNoteContentType
  content: string
  /** When set, skip embed/upsert if content has not changed. */
  previousContentHash?: string | null
}

export interface NoteReindexResult {
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

export async function hashNoteContent(content: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function embedTexts(ai: CloudflareAiBindingLike, texts: string[]) {
  const vectors: number[][] = []

  for (let offset = 0; offset < texts.length; offset += EMBED_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBED_BATCH_SIZE)
    const response = await ai.run(NOTE_EMBEDDING_MODEL, { text: batch })
    const data = response.data
    if (!Array.isArray(data) || data.length !== batch.length) {
      throw new Error('Embedding model returned unexpected data shape.')
    }

    for (const row of data) {
      if (!Array.isArray(row) || row.length === 0) {
        throw new Error('Embedding model returned an empty vector.')
      }
      vectors.push(row)
    }
  }

  return vectors
}

export async function deleteNoteVectors(env: AppBindings, noteId: string) {
  const vectorize = env.VMS_NOTES_VECTORIZE
  if (!vectorize || !noteId.trim()) {
    return
  }

  await vectorize.deleteByIds(allPossibleVectorIdsForNote(noteId.trim()))
}

/**
 * Re-chunk, embed, and upsert a note into Vectorize.
 * Soft-skips when bindings are missing. Throws on embed/upsert failures so callers can log.
 */
export async function reindexNoteVectors(
  env: AppBindings,
  input: NoteReindexInput,
): Promise<NoteReindexResult> {
  const contentHash = await hashNoteContent(input.content)

  if (input.previousContentHash && input.previousContentHash === contentHash) {
    return { skipped: true, contentHash, chunkCount: 0 }
  }

  const vectorize = env.VMS_NOTES_VECTORIZE
  const ai = env.AI
  if (!vectorize || !ai) {
    return { skipped: true, contentHash, chunkCount: 0 }
  }

  const plainText = noteContentToPlainText(input.content, input.contentType)
  const chunks = chunkNoteText(plainText)

  await deleteNoteVectors(env, input.noteId)

  if (chunks.length === 0) {
    return { skipped: false, contentHash, chunkCount: 0 }
  }

  const embeddings = await embedTexts(ai, chunks)
  const title = truncateMetadata(input.title.trim() || input.noteId, TITLE_METADATA_MAX)
  const vectors: VectorizeVectorLike[] = chunks.map((chunk, index) => ({
    id: vectorIdForNoteChunk(input.noteId, index),
    values: embeddings[index]!,
    metadata: {
      projectId: input.projectId,
      noteId: input.noteId,
      contentType: input.contentType,
      title,
      chunkIndex: index,
      text: truncateMetadata(chunk, CHUNK_METADATA_MAX),
    },
  }))

  await vectorize.upsert(vectors)
  return { skipped: false, contentHash, chunkCount: chunks.length }
}

export async function embedQueryText(env: AppBindings, text: string) {
  const ai = env.AI
  if (!ai) {
    return null
  }

  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const [vector] = await embedTexts(ai, [trimmed])
  return vector ?? null
}
