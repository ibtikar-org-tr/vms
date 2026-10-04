import { z } from 'zod'

const requiredTrimmedString = z.string().trim().min(1)
const optionalTrimmedString = z.string().trim().min(1).optional()
const optionalRichText = z.string().max(20000).nullable().optional()
const eventSkillsSchema = z.record(z.string().trim().min(1), z.string().trim().min(1)).optional()
const eventUrlsSchema = z.object({}).passthrough().nullable().optional()

export const createEventSchema = z.object({
  name: requiredTrimmedString.max(160),
  description: optionalRichText,
  startTime: optionalTrimmedString,
  endTime: optionalTrimmedString,
  status: z.enum(['draft', 'public', 'archived']),
  imageUrl: optionalTrimmedString,
  associatedUrls: eventUrlsSchema,
  createdBy: requiredTrimmedString,
  projectId: requiredTrimmedString,
  skills: eventSkillsSchema,
  telegramGroupId: optionalTrimmedString,
  country: optionalTrimmedString,
  region: optionalTrimmedString,
  city: optionalTrimmedString,
  address: optionalTrimmedString,
  displayAttendeeNumbers: z.boolean().optional(),
  cancellationDeadlineHours: z.number().int().min(0).max(24 * 365).optional(),
  allowGuestRegistration: z.boolean().optional(),
  registrationSuccessMessage: optionalRichText,
})

export const updateEventSchema = createEventSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field is required')

export const eventParamsSchema = z.object({
  id: requiredTrimmedString,
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
