import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handleScheduledIngest } from './cron/ingest'
import chatRoutes from './routes/chat'
import ingestRoutes from './routes/ingest'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', async (c, next) => {
  const origins = c.env.CORS_ALLOW_ORIGINS || '*'
  const middleware = cors({
    origin: origins === '*' ? '*' : origins.split(',').map((value) => value.trim()),
  })
  return middleware(c, next)
})

const MS_BASE = '/ms/chatbot'

app.get('/', (c) => c.redirect(MS_BASE))

app.get(MS_BASE, (c) => {
  return c.json({
    name: 'Ibtikar Chatbot',
    status: 'ok',
    endpoints: {
      health: `GET ${MS_BASE}/health`,
      chat: `POST ${MS_BASE}/chat`,
      ingest: `POST ${MS_BASE}/internal/ingest`,
    },
  })
})

app.get(`${MS_BASE}/health`, (c) => {
  return c.json({
    status: 'ok',
    service: 'ibtikar-chatbot',
    chatModel: c.env.CHAT_MODEL,
    embeddingModel: c.env.EMBEDDING_MODEL,
  })
})

app.route(`${MS_BASE}/chat`, chatRoutes)
app.route(`${MS_BASE}/internal/ingest`, ingestRoutes)


app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(handleScheduledIngest(env))
  },
}
