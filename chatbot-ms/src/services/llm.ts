import { IBTIKAR_CHAT_SYSTEM_PROMPT } from '../prompts/system'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface AiRunResult {
  response?: unknown
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function extractText(result: AiRunResult) {
  if (typeof result.response === 'string' && result.response.trim()) {
    return result.response.trim()
  }

  const choiceContent = result.choices?.[0]?.message?.content
  if (typeof choiceContent === 'string' && choiceContent.trim()) {
    return choiceContent.trim()
  }

  throw new Error('Workers AI returned an empty response')
}

export async function answerWithContext(
  env: CloudflareBindings,
  question: string,
  context: string,
) {
  const model = env.CHAT_MODEL || '@cf/google/gemma-4-26b-a4b-it'
  const contextBlock =
    context.trim() ||
    'No retrieved material was available for this question.'

  const messages: ChatMessage[] = [
    { role: 'system', content: IBTIKAR_CHAT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Context:\n${contextBlock}\n\nQuestion:\n${question}`,
    },
  ]

  const result = (await env.AI.run(model as keyof AiModels, {
    messages,
    chat_template_kwargs: {
      enable_thinking: false,
    },
  })) as AiRunResult

  return {
    reply: extractText(result),
    model,
  }
}
