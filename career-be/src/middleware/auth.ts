import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types/env'
import { verifyVmsAccessToken } from '../utils/vms-jwt'

export const memberAuthMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  if (!c.env.MEMBERSHIP_MS_SERVICE && !c.env.VMS_API_BASE?.trim()) {
    console.error('MEMBERSHIP_MS_SERVICE / VMS_API_BASE not configured on career-backend')
    return c.json({ message: 'Auth not configured' }, 500)
  }

  const payload = await verifyVmsAccessToken(c.env, token)
  if (!payload) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  c.set('member', {
    membership_number: payload.sub,
    email: payload.email,
    vms_role: payload.role,
  })

  await next()
}
