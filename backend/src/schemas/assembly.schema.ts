import { z } from 'zod'

export const assemblyMembersQuerySchema = z.object({
  q: z.string().trim().optional(),
  volunteersOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export const createAssemblyAnnouncementSchema = z
  .object({
    subject: z.string().trim().min(3).max(160),
    body: z.string().trim().min(8).max(8000),
    sendEmail: z.boolean().optional(),
    sendTelegram: z.boolean().optional(),
  })
  .refine((payload) => payload.sendEmail !== false || payload.sendTelegram !== false, {
    message: 'اختر تيليغرام أو البريد أو كليهما.',
  })

export const assemblyAnnouncementParamsSchema = z.object({
  id: z.string().trim().min(1),
})
