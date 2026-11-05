const MAX_TICKETS_PER_REQUEST = 20

export function uniqueTicketIds(input: { ticketId?: string; ticketIds?: string[] }) {
  const ids = [
    ...(input.ticketIds ?? []),
    ...(input.ticketId ? [input.ticketId] : []),
  ]
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  return [...new Set(ids)]
}

export function validateRequestedTicketIds(
  ticketIds: string[],
  options?: { allowMultipleTickets?: boolean },
) {
  if (ticketIds.length === 0) {
    return 'يرجى اختيار تذكرة واحدة على الأقل.'
  }

  const max = options?.allowMultipleTickets ? MAX_TICKETS_PER_REQUEST : 1
  if (ticketIds.length > max) {
    return options?.allowMultipleTickets
      ? 'لا يمكن اختيار أكثر من 20 تذكرة في طلب واحد.'
      : 'يرجى اختيار تذكرة واحدة فقط.'
  }

  return null
}
