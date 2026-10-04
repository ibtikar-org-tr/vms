import { apiGetJson, apiPostJson } from '@/src/api/client'
import type { VmsEvent } from '@/src/types/events'
import type { VmsEventRegistration, VmsEventTicket } from '@/src/types/events'

export function fetchEvents() {
  return apiGetJson<{ events: VmsEvent[] }>('/events')
}

export function fetchEventById(eventId: string) {
  return apiGetJson<{ event: VmsEvent }>(`/events/${encodeURIComponent(eventId)}`)
}

export function fetchEventTickets(eventId: string) {
  return apiGetJson<{ eventTickets: VmsEventTicket[] }>(
    `/event-tickets?eventId=${encodeURIComponent(eventId)}`,
  )
}

export function fetchMyEventRegistration(eventId: string, membershipNumber: string) {
  return apiGetJson<{ eventRegistrations: VmsEventRegistration[] }>(
    `/event-registrations?eventId=${encodeURIComponent(eventId)}&membershipNumber=${encodeURIComponent(membershipNumber)}`,
  )
}

export function createEventRegistration(payload: {
  eventId: string
  ticketId?: string
  ticketIds?: string[]
  membershipNumber: string
  status?: 'registered' | 'attended' | 'cancelled' | 'no_show'
}) {
  return apiPostJson<
    { eventRegistration: VmsEventRegistration; eventRegistrations?: VmsEventRegistration[] },
    typeof payload
  >('/event-registrations', {
    status: 'registered',
    ...payload,
  })
}

export function selfCancelEventRegistration(registrationId: string) {
  return apiPostJson<{ eventRegistration: VmsEventRegistration }, Record<string, never>>(
    `/event-registrations/${encodeURIComponent(registrationId)}/self-cancel`,
    {},
  )
}

export function changeEventRegistrationTicket(registrationId: string, ticketId: string) {
  return apiPostJson<{ eventRegistration: VmsEventRegistration }, { ticketId: string }>(
    `/event-registrations/${encodeURIComponent(registrationId)}/change-ticket`,
    { ticketId },
  )
}
