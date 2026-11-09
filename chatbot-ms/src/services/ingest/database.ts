import {
  listActivePrograms,
  listOpenVolunteeringPositions,
  listPublicEvents,
  type PublicEventRow,
} from '../../repositories/public-content'
import { stripHtmlToText, truncate } from '../../utils/text'
import type { IngestDocument } from '../vectorize'
import { upsertDocument } from '../vectorize'

function locationLine(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ')
}

function toPlain(description: string | null) {
  if (!description) {
    return ''
  }
  return stripHtmlToText(description)
}

function formatEventBlock(event: PublicEventRow, membersSite: string) {
  const location = locationLine([
    event.address,
    event.city,
    event.region,
    event.country,
  ])
  return [
    `Event: ${event.name}`,
    event.project_name ? `Program/project: ${event.project_name}` : '',
    event.start_time ? `Starts: ${event.start_time}` : '',
    event.end_time ? `Ends: ${event.end_time}` : '',
    location ? `Location: ${location}` : '',
    `Status: ${event.status}`,
    `URL: ${membersSite}/events/${event.id}`,
    toPlain(event.description),
  ]
    .filter(Boolean)
    .join('\n')
}

export async function ingestDatabase(env: CloudflareBindings) {
  const membersSite = env.MEMBERS_SITE_URL || 'https://ibtikar.tr'
  const [events, positions, programs] = await Promise.all([
    listPublicEvents(env.VMS_DB),
    listOpenVolunteeringPositions(env.VMS_DB),
    listActivePrograms(env.VMS_DB),
  ])

  const docs: IngestDocument[] = []

  // Catalog sorted newest-first so "آخر الفعاليات" retrieves a chronologically ordered list.
  if (events.length > 0) {
    const catalogBody = events
      .map((event, index) => {
        const location = locationLine([
          event.address,
          event.city,
          event.region,
          event.country,
        ])
        return [
          `${index + 1}. ${event.name}`,
          event.start_time ? `   Start: ${event.start_time}` : '   Start: unknown',
          event.end_time ? `   End: ${event.end_time}` : '',
          location ? `   Location: ${location}` : '',
          event.project_name ? `   Program: ${event.project_name}` : '',
          `   URL: ${membersSite}/events/${event.id}`,
        ]
          .filter(Boolean)
          .join('\n')
      })
      .join('\n\n')

    docs.push({
      docId: 'database:events-catalog',
      source: 'database',
      kind: 'events_catalog',
      title: 'Public events catalog (newest first)',
      url: `${membersSite}`,
      startTime: events[0]?.start_time || undefined,
      text: truncate(
        [
          'Public Ibtikar events listed newest-first by start date.',
          'When answering "آخر الفعاليات" / latest events, keep this newest-first order.',
          catalogBody,
        ].join('\n\n'),
        40_000,
      ),
    })
  }

  for (const event of events) {
    docs.push({
      docId: `database:event:${event.id}`,
      source: 'database',
      kind: 'event',
      title: event.name,
      url: `${membersSite}/events/${event.id}`,
      startTime: event.start_time || undefined,
      text: truncate(formatEventBlock(event, membersSite), 40_000),
    })
  }

  for (const position of positions) {
    docs.push({
      docId: `database:position:${position.id}`,
      source: 'database',
      kind: 'volunteering_position',
      title: position.name,
      url: `${membersSite}`,
      text: truncate(
        [
          `Open volunteering position: ${position.name}`,
          position.project_name ? `Program/project: ${position.project_name}` : '',
          `Seats: ${position.seats}`,
          `Status: ${position.status}`,
          toPlain(position.description),
          `Members can apply after logging in at ${membersSite}.`,
        ]
          .filter(Boolean)
          .join('\n'),
        40_000,
      ),
    })
  }

  for (const project of programs) {
    docs.push({
      docId: `database:project:${project.id}`,
      source: 'database',
      kind: 'program',
      title: project.name,
      url: `${membersSite}`,
      text: truncate(
        [
          `Program/project: ${project.name}`,
          `Status: ${project.status}`,
          project.parent_project_id
            ? `Parent project id: ${project.parent_project_id}`
            : 'Top-level program',
          toPlain(project.description),
        ]
          .filter(Boolean)
          .join('\n'),
        40_000,
      ),
    })
  }

  let documents = 0
  let chunks = 0

  for (const doc of docs) {
    const result = await upsertDocument(env, doc)
    documents += 1
    chunks += result.chunkCount
  }

  return {
    documents,
    chunks,
    events: events.length,
    positions: positions.length,
    programs: programs.length,
  }
}
