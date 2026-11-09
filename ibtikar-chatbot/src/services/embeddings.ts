export const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-m3'
const EMBED_BATCH_SIZE = 8

export async function embedTexts(ai: Ai, model: string, texts: string[]) {
  const vectors: number[][] = []

  for (let offset = 0; offset < texts.length; offset += EMBED_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBED_BATCH_SIZE)
    const response = await ai.run(model as keyof AiModels, { text: batch })
    const data = (response as { data?: number[][] }).data

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

export async function embedQuery(ai: Ai, model: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const [vector] = await embedTexts(ai, model, [trimmed])
  return vector ?? null
}
