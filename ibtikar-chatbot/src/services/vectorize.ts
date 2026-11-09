import {
  allPossibleVectorIdsForDoc,
  chunkText,
  vectorIdForChunk,
} from './chunking'
import { embedTexts } from './embeddings'
import { truncate } from '../utils/text'

const TITLE_METADATA_MAX = 120
const CHUNK_METADATA_MAX = 1800

export type ContentSource = 'website' | 'database'

export interface IngestDocument {
  /** Stable id used as Vectorize vector id prefix (no colons preferred except namespace). */
  docId: string
  source: ContentSource
  title: string
  text: string
  url?: string
  kind?: string
}

export async function deleteDocumentVectors(
  vectorize: VectorizeIndex,
  docId: string,
) {
  await vectorize.deleteByIds(allPossibleVectorIdsForDoc(docId))
}

export async function upsertDocument(
  env: CloudflareBindings,
  doc: IngestDocument,
) {
  const chunks = chunkText(doc.text)
  await deleteDocumentVectors(env.IBTIKAR_CHAT_VECTORIZE, doc.docId)

  if (chunks.length === 0) {
    return { chunkCount: 0 }
  }

  const model = env.EMBEDDING_MODEL || '@cf/baai/bge-m3'
  const embeddings = await embedTexts(env.AI, model, chunks)
  const title = truncate(doc.title.trim() || doc.docId, TITLE_METADATA_MAX)

  const vectors = chunks.map((chunk, index) => ({
    id: vectorIdForChunk(doc.docId, index),
    values: embeddings[index]!,
    metadata: {
      source: doc.source,
      docId: doc.docId,
      title,
      kind: doc.kind || doc.source,
      url: doc.url || '',
      chunkIndex: index,
      text: truncate(chunk, CHUNK_METADATA_MAX),
    },
  }))

  await env.IBTIKAR_CHAT_VECTORIZE.upsert(vectors)
  return { chunkCount: chunks.length }
}

export async function querySimilarChunks(
  env: CloudflareBindings,
  queryVector: number[],
  topK: number,
) {
  return env.IBTIKAR_CHAT_VECTORIZE.query(queryVector, {
    topK,
    returnMetadata: 'all',
  })
}
