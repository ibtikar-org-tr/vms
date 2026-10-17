import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { EmailAlreadyExistsError, RegistrationEmailError } from '../errors/registration.errors'
import { sendSignupLinkEmail } from '../services/signup-email.service'
import {
  confirmEmailVerification,
  createEmailSignupLink,
  EmailVerificationTokenError,
  sanitizeRedirectPath,
  SignupTokenError,
  verifySignupToken,
} from '../services/signup-link.service'
import type { AppBindings } from '../types/bindings'

export const signupRoute = new Hono<{ Bindings: AppBindings }>()

const emailSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  redirect: z.string().trim().optional(),
})

signupRoute.post('/signup/email', zValidator('json', emailSignupSchema), async (c) => {
  try {
    const { email, redirect } = c.req.valid('json')
    const { url } = await createEmailSignupLink(c.env, email, sanitizeRedirectPath(redirect))
    await sendSignupLinkEmail(c.env, email, url)

    return c.json({
      message: 'أرسلنا رابط الانتساب إلى بريدك. افتحه لإكمال النموذج. الرابط صالح لمدة 24 ساعة.',
    })
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      return c.json(
        {
          error: 'هذا البريد مسجّل مسبقاً. يمكنك استرجاع العضوية من صفحة نسيت بياناتي.',
          code: 'EMAIL_ALREADY_REGISTERED',
        },
        409,
      )
    }

    if (error instanceof RegistrationEmailError) {
      return c.json({ error: error.message }, 503)
    }

    console.error('Failed to create email signup link', error)
    return c.json({ error: 'تعذّر إرسال رابط الانتساب. حاول مرة أخرى.' }, 500)
  }
})

signupRoute.get('/signup/intent', async (c) => {
  const token = c.req.query('token')?.trim()
  if (!token) {
    return c.json({ error: 'رابط الانتساب غير مكتمل.' }, 400)
  }

  try {
    const intent = await verifySignupToken(c.env, token)
    return c.json({
      channel: intent.channel,
      email: intent.channel === 'email' ? intent.email : null,
    })
  } catch (error) {
    if (error instanceof SignupTokenError) {
      return c.json({ error: error.message }, 400)
    }

    console.error('Failed to read signup intent', error)
    return c.json({ error: 'تعذّر التحقق من رابط الانتساب.' }, 500)
  }
})

signupRoute.get('/verify-email', async (c) => {
  const token = c.req.query('token')?.trim()
  if (!token) {
    return c.json({ error: 'رابط التأكيد غير مكتمل.' }, 400)
  }

  try {
    const result = await confirmEmailVerification(c.env, token)
    return c.json({
      success: true,
      alreadyVerified: result.alreadyVerified,
      message: result.alreadyVerified
        ? 'هذا البريد مؤكد مسبقاً.'
        : 'تم تأكيد البريد الإلكتروني.',
    })
  } catch (error) {
    if (error instanceof EmailVerificationTokenError) {
      return c.json({ error: error.message }, 400)
    }

    console.error('Failed to confirm email', error)
    return c.json({ error: 'تعذّر تأكيد البريد الإلكتروني.' }, 500)
  }
})
