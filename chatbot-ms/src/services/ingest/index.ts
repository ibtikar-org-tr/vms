import { ingestDatabase } from './database'
import { ingestWebsite } from './website'

export interface IngestSummary {
  startedAt: string
  finishedAt: string
  website: Awaited<ReturnType<typeof ingestWebsite>>
  database: Awaited<ReturnType<typeof ingestDatabase>>
}

export async function runFullIngest(env: CloudflareBindings): Promise<IngestSummary> {
  const startedAt = new Date().toISOString()
  console.log('[ingest] started', { startedAt })

  const website = await ingestWebsite(env)
  console.log('[ingest] website done', website)

  const database = await ingestDatabase(env)
  console.log('[ingest] database done', database)

  const finishedAt = new Date().toISOString()
  console.log('[ingest] finished', { finishedAt })

  return { startedAt, finishedAt, website, database }
}
