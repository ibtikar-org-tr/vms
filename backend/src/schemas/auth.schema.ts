import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  type: z.enum(['email', 'phone', 'membership_number']),
  value: z.string().trim().min(1),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(8),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const externalHandoffSchema = z.object({
  redirectUri: z.string().trim().url(),
  client: z.string().trim().min(1).optional(),
})

export const externalExchangeSchema = z.object({
  code: z.string().trim().min(1),
  /** Must match the redirectUri stored when the handoff code was created. */
  redirectUri: z.string().trim().url(),
  client: z.string().trim().min(1).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ExternalHandoffInput = z.infer<typeof externalHandoffSchema>
export type ExternalExchangeInput = z.infer<typeof externalExchangeSchema>
