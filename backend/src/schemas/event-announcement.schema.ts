import { z } from 'zod'

export const createEventAnnouncementSchema = z
  .object({
    subject: z.string().trim().min(3).max(160),
    body: z.string().trim().min(8).max(8000),
    sendEmail: z.boolean().optional(),
    sendTelegram: z.boolean().optional(),
  })
  .refine((payload) => payload.sendEmail !== false || payload.sendTelegram !== false, {
    message: 'اختر تيليغرام أو البريد أو كليهما.',
  })

export const eventAnnouncementEventParamsSchema = z.object({
  eventId: z.string().trim().min(1),
})

export const eventAnnouncementParamsSchema = z.object({
  eventId: z.string().trim().min(1),
  announcementId: z.string().trim().min(1),
})

export const retryEventAnnouncementSchema = z.object({
  channel: z.enum(['email', 'telegram']),
})
