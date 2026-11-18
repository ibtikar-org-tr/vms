import { Hono } from 'hono'
import { memberAuthMiddleware } from '../middleware/auth'
import { ensureCareerProfile } from '../repositories/profiles'
import { fetchVmsSelfProfile } from '../repositories/vms-profile'
import type { AppBindings } from '../types/env'
import { fetchVmsApi } from '../utils/vms-fetch'

const authRouter = new Hono<AppBindings>()

interface VmsExchangeResponse {
  membershipNumber: string
  email: string
  role: string
  accessToken: string
}

authRouter.post('/vms/exchange', async (c) => {
  const body = await c.req.json<{ code?: string }>().catch(() => ({} as { code?: string }))
  const code = body.code?.trim()
  if (!code) {
    return c.json({ message: 'code is required' }, 400)
  }

  const internalSecret = c.env.VMS_INTERNAL_SECRET?.trim()
  if (!internalSecret) {
    console.error('VMS_INTERNAL_SECRET is not configured')
    return c.json({ message: 'VMS exchange not configured' }, 500)
  }
  if (!c.env.MEMBERSHIP_MS_SERVICE && !c.env.VMS_API_BASE?.trim()) {
    console.error('MEMBERSHIP_MS_SERVICE / VMS_API_BASE not configured')
    return c.json({ message: 'VMS exchange not configured' }, 500)
  }

  let exchangePayload: VmsExchangeResponse
  try {
    const response = await fetchVmsApi(c.env, '/external-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': internalSecret,
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('VMS external-exchange failed', response.status, text)
      if (response.status === 401) {
        return c.json({ message: 'VMS rejected internal auth (check INTERNAL_SECRET)' }, 502)
      }
      if (response.status === 400) {
        return c.json({ message: 'Invalid or expired code' }, 401)
      }
      return c.json({ message: 'Could not exchange code with VMS' }, 502)
    }

    exchangePayload = (await response.json()) as VmsExchangeResponse
  } catch (error) {
    console.error('VMS external-exchange request failed', error)
    return c.json({ message: 'Could not reach VMS' }, 502)
  }

  await ensureCareerProfile(c.env, exchangePayload.membershipNumber)

  return c.json({
    access_token: exchangePayload.accessToken,
    token_type: 'bearer',
    user: {
      membershipNumber: exchangePayload.membershipNumber,
      email: exchangePayload.email,
      role: exchangePayload.role,
    },
  })
})

authRouter.get('/me', memberAuthMiddleware, async (c) => {
  const member = c.get('member')
  await ensureCareerProfile(c.env, member.membership_number)

  const vmsProfile = await fetchVmsSelfProfile(
    c.env,
    member.membership_number,
    c.req.header('Authorization'),
  )

  return c.json({
    user: {
      membershipNumber: member.membership_number,
      email: member.email,
      role: member.vms_role,
    },
    vmsProfile,
  })
})

export default authRouter
