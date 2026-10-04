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

export function validateRequestedTicketIds(ticketIds: string[]) {
  if (ticketIds.length === 0) {
    return 'يرجى اختيار تذكرة واحدة على الأقل.'
  }

  if (ticketIds.length > MAX_TICKETS_PER_REQUEST) {
    return `يمكن اختيار حتى ${MAX_TICKETS_PER_REQUEST} تذكرة في الطلب الواحد.`
  }

  return null
}
