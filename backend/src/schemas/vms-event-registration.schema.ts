import { z } from 'zod'

const requiredTrimmedString = z.string().trim().min(1)

export const eventRegistrationStatusSchema = z.enum(['registered', 'attended', 'cancelled', 'no_show'])

const eventRegistrationFieldsSchema = z.object({
  eventId: requiredTrimmedString,
  membershipNumber: requiredTrimmedString,
  ticketId: requiredTrimmedString,
  status: eventRegistrationStatusSchema,
  paymentApprovedBy: requiredTrimmedString.optional(),
  attendanceApprovedBy: requiredTrimmedString.optional(),
})

export const createEventRegistrationSchema = eventRegistrationFieldsSchema
  .extend({
    ticketId: requiredTrimmedString.optional(),
    ticketIds: z.array(requiredTrimmedString).min(1).max(20).optional(),
  })
  .refine((payload) => Boolean(payload.ticketId || (payload.ticketIds && payload.ticketIds.length > 0)), {
    message: 'ticketId or ticketIds is required',
    path: ['ticketIds'],
  })

export const updateEventRegistrationSchema = eventRegistrationFieldsSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, 'At least one field is required')

export const eventRegistrationParamsSchema = z.object({
  id: requiredTrimmedString,
})

export const eventRegistrantContactParamsSchema = z.object({
  eventId: requiredTrimmedString,
  membershipNumber: requiredTrimmedString,
})

export const eventRegistrationCountsParamsSchema = z.object({
  eventId: requiredTrimmedString,
})

export const changeEventRegistrationTicketSchema = z.object({
  ticketId: requiredTrimmedString,
})

export const createGuestEventRegistrationSchema = z
  .object({
    ticketId: requiredTrimmedString.optional(),
    ticketIds: z.array(requiredTrimmedString).min(1).max(20).optional(),
    guestName: requiredTrimmedString.max(160),
    guestEmail: z.string().trim().toLowerCase().email(),
    guestPhone: requiredTrimmedString.max(40),
  })
  .refine((payload) => Boolean(payload.ticketId || (payload.ticketIds && payload.ticketIds.length > 0)), {
    message: 'ticketId or ticketIds is required',
    path: ['ticketIds'],
  })

export type CreateEventRegistrationInput = z.infer<typeof createEventRegistrationSchema>
export type UpdateEventRegistrationInput = z.infer<typeof updateEventRegistrationSchema>
export type CreateGuestEventRegistrationInput = z.infer<typeof createGuestEventRegistrationSchema>
