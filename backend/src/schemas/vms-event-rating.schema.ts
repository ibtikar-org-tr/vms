import { z } from 'zod'
import { eventFormFieldInputSchema, eventFormFieldTypeSchema } from './vms-event-form.schema'

export const eventRatingFieldTypeSchema = eventFormFieldTypeSchema

export const eventRatingFieldInputSchema = eventFormFieldInputSchema

export const replaceEventRatingFieldsSchema = z.object({
  fields: z.array(eventRatingFieldInputSchema).max(40),
})

export const createEventRatingSchema = z.object({
  score: z.number().int().min(1).max(10),
  feedback: z.string().trim().max(4000).optional().default(''),
  answers: z.record(z.string(), z.string().max(4000)).optional(),
  hideInfo: z.boolean().optional().default(false),
})

export type EventRatingFieldType = z.infer<typeof eventRatingFieldTypeSchema>
export type EventRatingFieldInput = z.infer<typeof eventRatingFieldInputSchema>
export type ReplaceEventRatingFieldsInput = z.infer<typeof replaceEventRatingFieldsSchema>
export type CreateEventRatingInput = z.infer<typeof createEventRatingSchema>
