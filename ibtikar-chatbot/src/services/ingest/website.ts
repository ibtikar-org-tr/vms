import { slugifyDocId, stripHtmlToText, truncate } from '../../utils/text'
import type { IngestDocument } from '../vectorize'
import { upsertDocument } from '../vectorize'
import { buildOrgSeedDocuments } from './org-seed'

function parseIngestUrls(env: CloudflareBindings) {
  const configured = (env.WEBSITE_INGEST_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  const defaults = [
    env.WEBSITE_BASE_URL || 'https://ibtikar.org.tr',
    env.MEMBERS_SITE_URL || 'https://ibtikar.tr',
  ]

  return [...new Set([...defaults, ...configured])]
}

function extractTitle(html: string, fallback: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) {
    return fallback
  }
  return stripHtmlToText(match[1]).slice(0, 160) || fallback
}

async function fetchPageDocument(url: string): Promise<IngestDocument | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IbtikarChatbotIngest/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      console.warn('[ingest:website] fetch failed', { url, status: response.status })
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      console.warn('[ingest:website] skipping non-html', { url, contentType })
      return null
    }

    const html = await response.text()
    const text = stripHtmlToText(html)
    if (text.length < 40) {
      console.warn('[ingest:website] page too short', { url, length: text.length })
      return null
    }

    const title = extractTitle(html, url)
    return {
      docId: `website:page:${slugifyDocId(url)}`,
      source: 'website',
      kind: 'website_page',
      title,
      url,
      text: truncate(text, 40_000),
    }
  } catch (error) {
    console.warn('[ingest:website] fetch error', { url, error })
    return null
  }
}

export async function ingestWebsite(env: CloudflareBindings) {
  const docs: IngestDocument[] = [...buildOrgSeedDocuments(env)]
  const urls = parseIngestUrls(env)

  for (const url of urls) {
    const page = await fetchPageDocument(url)
    if (page) {
      docs.push(page)
    }
  }

  let documents = 0
  let chunks = 0

  for (const doc of docs) {
    const result = await upsertDocument(env, doc)
    documents += 1
    chunks += result.chunkCount
  }

  return { documents, chunks, urlsAttempted: urls.length }
}
