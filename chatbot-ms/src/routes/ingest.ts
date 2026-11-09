import { Hono } from 'hono'
import { runFullIngest } from '../services/ingest'
import { secretsEqual } from '../utils/auth'

const ingest = new Hono<{ Bindings: CloudflareBindings }>()

/**
 * Manual ingest trigger for operators.
 * Requires Authorization: Bearer <INTERNAL_SECRET>
 * Daily production ingest is driven by the cron trigger, not DB writes.
 */
ingest.post('/', async (c) => {
  const expected = c.env.INTERNAL_SECRET || ''
  const header = c.req.header('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

  if (!expected || !(await secretsEqual(token, expected))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const summary = await runFullIngest(c.env)
    return c.json({ ok: true, summary })
  } catch (error) {
    console.error('[ingest:http] failed', error)
    return c.json({ error: 'Ingest failed' }, 500)
  }
})

export default ingest
