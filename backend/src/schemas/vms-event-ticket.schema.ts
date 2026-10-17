import { z } from 'zod'

const requiredTrimmedString = z.string().trim().min(1)
const optionalTicketText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return value === null ? null : undefined
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
const integerString = z
  .string()
  .trim()
  .regex(/^-?\d+$/, 'Must be an integer')
  .transform((value) => Number(value))

const coercedInt = z.union([z.number().int(), integerString.pipe(z.number().int())])
const coercedNonNegativeInt = z.union([
  z.number().int().min(0),
  integerString.pipe(z.number().int().min(0)),
])

export const createEventTicketSchema = z.object({
  eventId: requiredTrimmedString,
  name: requiredTrimmedString.max(160),
  description: optionalTicketText,
  pointPrice: coercedInt,
  currencyPrice: optionalTicketText,
  quantity: coercedNonNegativeInt,
})

export const updateEventTicketSchema = createEventTicketSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field is required')

export const eventTicketParamsSchema = z.object({
  id: requiredTrimmedString,
})

export const approveEventTicketSchema = z.object({
  ticketId: requiredTrimmedString,
})

export const eventTicketParamsWithApproverSchema = z.object({
  id: requiredTrimmedString,
  approver: requiredTrimmedString,
})

export type CreateEventTicketInput = z.infer<typeof createEventTicketSchema>
export type UpdateEventTicketInput = z.infer<typeof updateEventTicketSchema>
