export function formatEventDate(value: string | null): string {
  if (!value) {
    return 'غير محدد'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatEventDateShort(value: string | null): string {
  if (!value) {
    return 'غير محدد'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatEventLocation(event: {
  city: string | null
  region: string | null
  country: string | null
  address: string | null
}): string {
  const parts = [event.city, event.region, event.country].filter(
    (part): part is string => Boolean(part?.trim()),
  )

  if (parts.length > 0) {
    return parts.join('، ')
  }

  if (event.address?.trim()) {
    return event.address.trim()
  }

  return 'الموقع غير محدد'
}

export function eventDescriptionPlainText(value: string | null | undefined) {
  if (!value?.trim()) {
    return ''
  }

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isEventUpcomingOrOngoing(event: {
  startTime: string | null
  endTime: string | null
}): boolean {
  const now = Date.now()
  const end = event.endTime ? new Date(event.endTime).getTime() : NaN
  if (!Number.isNaN(end)) {
    return end >= now
  }

  const start = event.startTime ? new Date(event.startTime).getTime() : NaN
  if (!Number.isNaN(start)) {
    return start >= now
  }

  return true
}
