import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppBindings } from './types/env'
import authRouter from './routers/auth'
import profilesRouter from './routers/profiles'

const app = new Hono<AppBindings>()

app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

app.get('/', (c) =>
  c.json({
    message: 'Ibtikar Career Platform API',
    version: '1.0.0',
    runtime: 'Cloudflare Workers + Hono + D1 + R2',
    endpoints: {
      auth: '/api/auth',
      profiles: '/api/profiles',
    },
  }),
)

app.get('/health', (c) =>
  c.json({ status: 'healthy', app: c.env.APP_NAME }),
)

app.route('/api/auth', authRouter)
app.route('/api/profiles', profilesRouter)

export default app
