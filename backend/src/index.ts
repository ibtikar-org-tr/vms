import { Hono } from 'hono'
import { membershipAppCors } from './utils/cors'
import { authMiddleware } from './middleware/auth.middleware'
import { authRoute, securedAuthRoute } from './routes/auth.route'
import { profileRoute } from './routes/profile.route'
import { registrationRoute } from './routes/registration.route'
import { statsRoute } from './routes/stats.route'
import { telegramNotificationRoute } from './routes/telegram-notification.route'
import { vmsEventRegistrationsRoute } from './routes/vms-event-registrations.route'
import { vmsEventTicketsRoute } from './routes/vms-event-tickets.route'
import { vmsPublicEventsRoute } from './routes/vms-public-events.route'
import { vmsEventsRoute } from './routes/vms-events.route'
import { vmsClubsRoute } from './routes/vms-clubs.route'
import { vmsLeaderboardRoute } from './routes/vms-leaderboard.route'
import { vmsPointTransactionsRoute } from './routes/vms-point-transactions.route'
import { vmsProjectMembersRoute } from './routes/vms-project-members.route'
import { vmsProjectsRoute } from './routes/vms-projects.route'
import { vmsPositionsRoute } from './routes/vms-positions.route'
import { vmsSkillsRoute } from './routes/vms-skills.route'
import { vmsAgendaRoute } from './routes/vms-agenda.route'
import { vmsTasksRoute } from './routes/vms-tasks.route'
import { handleProjectNoteWebSocket, vmsProjectNotesRoute } from './routes/vms-project-notes.route'
import { uploadClubBanner, uploadEventBanner, uploadImages, serveImage } from './routes/images.route'
import { handleCron } from './cron'
import { ProjectNoteRoom } from './durable-objects/project-note-room'
import { reindexAllProjectNotes } from './services/note-vector-backfill.service'
import type { AppBindings } from './types/bindings'
import type { AppEnv } from './types/hono'

export { ProjectNoteRoom }

const app = new Hono<{ Bindings: AppBindings }>()

app.use('/ms/membership-app/api/*', membershipAppCors())

app.get('/ms/membership-app/api/event-images/*', serveImage)

app.get('/ms/membership-app', (c) => {
  return c.json({
    service: 'membership-app-backend',
    status: 'ok',
  })
})

app.get('/ms/membership-app/health', (c) => {
  return c.json({
    service: 'membership-app-backend',
    status: 'healthy',
  })
})

app.post('/ms/membership-app/api/internal/cron', async (c) => {
  const apiKey = c.req.header('X-API-Key')?.trim()
  const expected = c.env.INTERNAL_SECRET?.trim()

  if (!expected || apiKey !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const stats = await handleCron(c.env)
  return c.json({ ok: true, stats })
})

app.post('/ms/membership-app/api/internal/reindex-project-notes', async (c) => {
  const apiKey = c.req.header('X-API-Key')?.trim()
  const expected = c.env.INTERNAL_SECRET?.trim()

  if (!expected || apiKey !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      projectId?: string
      limit?: number
    }

    const stats = await reindexAllProjectNotes(c.env, {
      projectId: body.projectId?.trim() || undefined,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    })

    return c.json({ ok: true, stats })
  } catch (error) {
    console.error('Failed to reindex project notes', error)
    return c.json({ error: 'Could not reindex project notes.' }, 500)
  }
})

app.get('/ms/membership-app/api/projects/:projectId/notes/ws', async (c) => {
  return handleProjectNoteWebSocket(c.req.raw, c.env, c.req.param('projectId'))
})

const publicApi = new Hono<{ Bindings: AppBindings }>()
publicApi.get('/projects/:projectId/notes/ws', async (c) => {
  return handleProjectNoteWebSocket(c.req.raw, c.env, c.req.param('projectId'))
})
publicApi.route('/', registrationRoute)
publicApi.route('/', statsRoute)
publicApi.route('/', authRoute)
publicApi.route('/', vmsPublicEventsRoute)

const securedApi = new Hono<AppEnv>()
securedApi.use('*', authMiddleware)
securedApi.route('/', securedAuthRoute)
securedApi.route('/', profileRoute)
securedApi.route('/', telegramNotificationRoute)
securedApi.route('/', vmsProjectsRoute)
securedApi.route('/', vmsPositionsRoute)
securedApi.route('/', vmsTasksRoute)
securedApi.route('/', vmsAgendaRoute)
securedApi.route('/', vmsProjectMembersRoute)
securedApi.route('/', vmsEventsRoute)
securedApi.route('/', vmsClubsRoute)
securedApi.route('/', vmsEventTicketsRoute)
securedApi.route('/', vmsEventRegistrationsRoute)
securedApi.route('/', vmsSkillsRoute)
securedApi.route('/', vmsLeaderboardRoute)
securedApi.route('/', vmsPointTransactionsRoute)
securedApi.route('/', vmsProjectNotesRoute)
securedApi.post('/images/upload', uploadImages)
securedApi.put('/events/:id/banner', uploadEventBanner)
securedApi.put('/clubs/:id/banner', uploadClubBanner)

app.route('/ms/membership-app/api', publicApi)
app.route('/ms/membership-app/api', securedApi)

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: AppBindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(handleCron(env))
  },
}
