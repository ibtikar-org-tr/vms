import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppBindings } from './types/env'
import authRouter from './routers/auth'
import profilesRouter from './routers/profiles'

const app = new Hono<AppBindings>()
const MS_BASE = '/ms/career'

app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

app.get('/', (c) => c.redirect(MS_BASE))

app.get(MS_BASE, (c) =>
  c.json({
    message: 'Ibtikar Career Platform API',
    version: '1.0.0',
    runtime: 'Cloudflare Workers + Hono + D1 + R2',
    endpoints: {
      health: `GET ${MS_BASE}/health`,
      auth: `${MS_BASE}/api/auth`,
      profiles: `${MS_BASE}/api/profiles`,
    },
  }),
)

app.get(`${MS_BASE}/health`, (c) =>
  c.json({ status: 'healthy', app: c.env.APP_NAME }),
)

app.route(`${MS_BASE}/api/auth`, authRouter)
app.route(`${MS_BASE}/api/profiles`, profilesRouter)

app.notFound((c) => c.json({ message: 'Not found' }, 404))

export default app
