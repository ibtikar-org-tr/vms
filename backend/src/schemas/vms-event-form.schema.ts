import { z } from 'zod'

const requiredTrimmedString = z.string().trim().min(1)

export const eventFormFieldTypeSchema = z.enum(['text', 'textarea', 'email', 'phone', 'url', 'number'])

export const eventFormFieldInputSchema = z.object({
  label: requiredTrimmedString.max(200),
  description: z.string().trim().max(800).optional(),
  type: eventFormFieldTypeSchema,
  required: z.boolean().optional(),
})

export const replaceEventFormFieldsSchema = z.object({
  fields: z.array(eventFormFieldInputSchema).max(40),
})

export const createEventFormSubmissionSchema = z.object({
  applicantName: requiredTrimmedString.max(160),
  applicantEmail: z.string().trim().toLowerCase().email(),
  applicantPhone: requiredTrimmedString.max(40),
  answers: z.record(z.string(), z.string().max(4000)).optional(),
})

export type EventFormFieldType = z.infer<typeof eventFormFieldTypeSchema>
export type EventFormFieldInput = z.infer<typeof eventFormFieldInputSchema>
export type ReplaceEventFormFieldsInput = z.infer<typeof replaceEventFormFieldsSchema>
export type CreateEventFormSubmissionInput = z.infer<typeof createEventFormSubmissionSchema>
