import { embedQuery } from './embeddings'
import { querySimilarChunks } from './vectorize'

const RAG_CONTEXT_MAX_CHARS = 7_000
const RAG_MIN_SCORE = 0.2

type MetadataValue = string | number | boolean | null

type RetrievedMatch = {
  id: string
  score: number
  metadata?: Record<string, MetadataValue>
}

function metadataString(
  metadata: Record<string, MetadataValue> | undefined,
  key: string,
) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : ''
}

function metadataNumber(
  metadata: Record<string, MetadataValue> | undefined,
  key: string,
) {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isEventLike(kind: string) {
  return kind === 'event' || kind === 'events_catalog'
}

function startTimeMs(metadata: Record<string, MetadataValue> | undefined) {
  const raw = metadataString(metadata, 'startTime').trim()
  if (!raw) {
    return Number.NEGATIVE_INFINITY
  }
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

/** Prefer catalogs, then newer events first, then higher similarity. */
function sortMatchesForContext(matches: RetrievedMatch[]) {
  return [...matches].sort((a, b) => {
    const kindA = metadataString(a.metadata, 'kind')
    const kindB = metadataString(b.metadata, 'kind')
    const catalogA = kindA === 'events_catalog' ? 1 : 0
    const catalogB = kindB === 'events_catalog' ? 1 : 0
    if (catalogA !== catalogB) {
      return catalogB - catalogA
    }

    if (isEventLike(kindA) && isEventLike(kindB)) {
      const timeDiff = startTimeMs(b.metadata) - startTimeMs(a.metadata)
      if (timeDiff !== 0) {
        return timeDiff
      }
    }

    return b.score - a.score
  })
}

export function formatRetrievedContext(matches: RetrievedMatch[]) {
  const parts: string[] = []
  let used = 0

  for (const match of sortMatchesForContext(matches)) {
    if (match.score < RAG_MIN_SCORE) {
      continue
    }

    const text = metadataString(match.metadata, 'text').trim()
    if (!text) {
      continue
    }

    const title = metadataString(match.metadata, 'title') || 'Untitled'
    const source = metadataString(match.metadata, 'source') || 'unknown'
    const kind = metadataString(match.metadata, 'kind') || source
    const url = metadataString(match.metadata, 'url')
    const startTime = metadataString(match.metadata, 'startTime')
    const chunkIndex = metadataNumber(match.metadata, 'chunkIndex')
    const urlSuffix = url ? ` ${url}` : ''
    const timeSuffix = startTime ? ` start=${startTime}` : ''
    const chunkSuffix = chunkIndex == null ? '' : ` #${chunkIndex}`
    const header = `[${kind}/${source}] ${title}${chunkSuffix}${timeSuffix}${urlSuffix}`
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

  return `Retrieved Ibtikar material (answer only from this).\nEvents in this context are ordered newest-first when dates are available.\n---\n${parts.join('\n---\n')}\n---`
}

export async function retrieveContextForQuestion(
  env: CloudflareBindings,
  question: string,
) {
  const embeddingModel = env.EMBEDDING_MODEL || '@cf/baai/bge-m3'
  const topK = Math.max(1, Number.parseInt(env.RAG_TOP_K || '8', 10) || 8)
  const queryVector = await embedQuery(env.AI, embeddingModel, question)

  if (!queryVector) {
    return { context: '', matchCount: 0 }
  }

  const result = await querySimilarChunks(env, queryVector, topK)
  const matches = (result.matches || []).map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata as Record<string, MetadataValue> | undefined,
  }))

  return {
    context: formatRetrievedContext(matches),
    matchCount: matches.length,
  }
}
