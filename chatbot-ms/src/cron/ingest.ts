import { runFullIngest } from '../services/ingest'

/** Daily cron entrypoint: re-ingest website + database into Vectorize. */
export async function handleScheduledIngest(env: CloudflareBindings) {
  try {
    const summary = await runFullIngest(env)
    console.log('[cron:ingest] completed', summary)
    return summary
  } catch (error) {
    console.error('[cron:ingest] failed', error)
    throw error
  }
}
