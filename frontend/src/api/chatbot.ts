const CHATBOT_BASE_URL = (import.meta.env.VITE_CHATBOT_MS as string | undefined)?.trim()

/** Base URL for the Ibtikar chatbot Worker (always under /ms/chatbot on the frontend host). */
export const CHATBOT_BASE = CHATBOT_BASE_URL
  ? CHATBOT_BASE_URL.replace(/\/+$/, '')
  : '/ms/chatbot'

export interface ChatbotReply {
  reply: string
  model?: string
  retrieval?: {
    matchCount: number
    hasContext: boolean
  }
}

export async function askIbtikarChatbot(message: string): Promise<ChatbotReply> {
  const response = await fetch(`${CHATBOT_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    let detail = `Chat request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (typeof body.error === 'string' && body.error.trim()) {
        detail = body.error
      }
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  return (await response.json()) as ChatbotReply
}
