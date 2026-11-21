import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  Bot,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Link2,
  MessageCircle,
  Music2,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react'

export type SocialLink = {
  key: string
  label: string
  url: string | null
  Icon: LucideIcon
}

const PLATFORM_META: Record<string, { label: string; Icon: LucideIcon }> = {
  facebook: { label: 'Facebook', Icon: Facebook },
  instagram: { label: 'Instagram', Icon: Instagram },
  linkedin: { label: 'LinkedIn', Icon: Linkedin },
  x: { label: 'X', Icon: Twitter },
  twitter: { label: 'X', Icon: Twitter },
  telegram: { label: 'Telegram', Icon: Send },
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle },
  github: { label: 'GitHub', Icon: Github },
  youtube: { label: 'YouTube', Icon: Youtube },
  tiktok: { label: 'TikTok', Icon: Music2 },
  huggingface: { label: 'Hugging Face', Icon: Bot },
  mastodon: { label: 'Mastodon', Icon: AtSign },
  website: { label: 'موقع', Icon: Globe },
  other: { label: 'رابط', Icon: Link2 },
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value && typeof value === 'object' && 'url' in value) {
    const url = String((value as { url?: unknown }).url || '').trim()
    return url || null
  }
  return null
}

/** Accepts VMS JSON string, object map, or already-normalized record. */
export function parseSocialMediaLinks(raw: unknown): Record<string, string | null> {
  if (raw == null) return {}

  let source: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    try {
      source = JSON.parse(trimmed)
    } catch {
      return {}
    }
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}

  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const platform = key.trim().toLowerCase()
    if (!platform) continue
    // Keep explicit null (privacy-redacted “linked”) and real URLs; drop empty.
    if (value === null) {
      out[platform] = null
      continue
    }
    const url = normalizeUrl(value)
    if (url) out[platform] = url
  }
  return out
}

/**
 * Linked platforms for CV display.
 * - Full access: only entries with a real URL (clickable).
 * - Limited/redacted: keys with null URL still count as "linked" (icon only).
 */
export function socialLinksFromProfile(raw: unknown, opts?: { includeRedacted?: boolean }): SocialLink[] {
  const includeRedacted = opts?.includeRedacted ?? true
  const map = parseSocialMediaLinks(raw)
  return Object.entries(map)
    .filter(([, url]) => (url ? true : includeRedacted && url === null))
    .map(([key, url]) => {
      const meta = PLATFORM_META[key] || {
        label: key,
        Icon: Link2,
      }
      return {
        key,
        label: meta.label,
        url,
        Icon: meta.Icon,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en'))
}

/** Limited mode: keep platform keys, strip URLs. */
export function redactSocialMediaLinks(raw: unknown): Record<string, null> {
  const map = parseSocialMediaLinks(raw)
  const out: Record<string, null> = {}
  for (const key of Object.keys(map)) {
    out[key] = null
  }
  return out
}
