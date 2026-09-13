import { aiEditedNoteSchema, type AiEditedNote } from '../schemas/vms-ai-note.schema'
import type { AppBindings } from '../types/bindings'
import type { ProjectNoteContentType } from '../schemas/vms-project-note.schema'
import { buildNoteRagContext } from './note-rag.service'

const NOTE_EDIT_MODELS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3-30b-a3b-fp8',
] as const

/** Primary Workers AI model used for note command edits (shown in the UI). */
export const NOTE_AI_PRIMARY_MODEL = NOTE_EDIT_MODELS[0]

const JSON_MODE_MODELS = new Set<string>([
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3-30b-a3b-fp8',
])

const NOTE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['content'],
} as const

const MAX_CONTENT_CHARS = 24_000

interface CloudflareAiBinding {
  run(
    model: string,
    inputs: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      max_tokens?: number
      temperature?: number
      response_format?: {
        type: 'json_schema'
        json_schema: typeof NOTE_JSON_SCHEMA
      }
    },
  ): Promise<{ response?: unknown }>
}

function buildSystemPrompt(contentType: ProjectNoteContentType) {
  const formatLabel = contentType === 'markdown' ? 'Markdown' : 'HTML'

  return `You are a collaborative note editor assistant for Ibtikar Assembly (تجمّع إبتكار).
The user will give a command to modify an existing project note.

Rules:
- Return JSON only with keys "content" (required) and "summary" (optional short description of the change).
- "content" must be the FULL revised note in ${formatLabel} format — never a partial snippet unless the user asked to replace everything with a short text.
- Preserve the user's language unless they ask to translate.
- Keep existing structure and meaning unless the command asks to change them.
- For HTML notes: use simple semantic tags (p, h1-h3, ul, ol, li, blockquote, strong, em, a, code, pre, hr). Do not include <html>, <head>, or <body>.
- For Markdown notes: use standard GFM (headings, lists, bold, italic, strike, links, fenced code, blockquotes, horizontal rules).
- Do not invent unrelated sections. Do not wrap JSON in markdown fences.
- You may receive related notes from the same project and a roster of other note titles. Use them only when the command needs project context (merge, summarize across notes, reference decisions). Never replace the current note with another note's full body unless explicitly asked.`
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    return trimmed
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim()
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

function normalizeAiResponsePayload(response: unknown): unknown {
  if (response == null) {
    return null
  }

  if (typeof response === 'string') {
    try {
      return JSON.parse(extractJsonObject(response))
    } catch {
      return null
    }
  }

  if (typeof response === 'object') {
    const record = response as Record<string, unknown>
    if ('content' in record && typeof record.content === 'string') {
      return record
    }

    if (typeof record.response === 'string') {
      try {
        return JSON.parse(extractJsonObject(record.response))
      } catch {
        return null
      }
    }

    if (record.response && typeof record.response === 'object') {
      return record.response
    }

    if (Array.isArray(record.choices)) {
      const content = (record.choices[0] as { message?: { content?: unknown } } | undefined)?.message
        ?.content
      if (typeof content === 'string') {
        try {
          return JSON.parse(extractJsonObject(content))
        } catch {
          return null
        }
      }
      if (content && typeof content === 'object') {
        return content
      }
    }
  }

  return null
}

function parseEditedNote(payload: unknown): AiEditedNote {
  const result = aiEditedNoteSchema.safeParse(payload)
  if (!result.success) {
    throw new Error('استجابة الذكاء الاصطناعي غير صالحة. حاول صياغة الأمر بشكل أوضح.')
  }

  return result.data
}

function truncateForModel(content: string) {
  if (content.length <= MAX_CONTENT_CHARS) {
    return content
  }

  return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n…[truncated for model context]`
}

export async function editNoteContentWithAi(
  env: AppBindings,
  input: {
    command: string
    content: string
    contentType: ProjectNoteContentType
    noteTitle?: string | null
    projectId: string
    noteId: string
  },
): Promise<AiEditedNote> {
  const ai = env.AI as CloudflareAiBinding | undefined
  if (!ai) {
    throw new Error('خدمة الذكاء الاصطناعي غير متوفرة حالياً.')
  }

  const rag = await buildNoteRagContext(env, {
    projectId: input.projectId,
    noteId: input.noteId,
    command: input.command,
    noteTitle: input.noteTitle,
  })

  const formatLabel = input.contentType === 'markdown' ? 'Markdown' : 'HTML'
  const titleLine = input.noteTitle?.trim() ? `Note title: ${input.noteTitle.trim()}\n` : ''
  const contextBlocks = [rag.rosterBlock, rag.relatedNotesBlock].filter(Boolean).join('\n\n')
  const contextSection = contextBlocks ? `${contextBlocks}\n\n` : ''

  const userMessage = `${titleLine}Format: ${formatLabel}

${contextSection}Current note content:
"""
${truncateForModel(input.content)}
"""

User command:
${input.command.trim()}`

  let parsedPayload: unknown
  let lastError: unknown

  for (const model of NOTE_EDIT_MODELS) {
    const useJsonSchemaAttempts = JSON_MODE_MODELS.has(model) ? [true, false] : [false]

    for (const useJsonSchema of useJsonSchemaAttempts) {
      try {
        const inputs: Parameters<CloudflareAiBinding['run']>[1] = {
          messages: [
            { role: 'system', content: buildSystemPrompt(input.contentType) },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        }

        if (useJsonSchema) {
          inputs.response_format = {
            type: 'json_schema',
            json_schema: NOTE_JSON_SCHEMA,
          }
        }

        const response = await ai.run(model, inputs)
        parsedPayload = normalizeAiResponsePayload(response)
        if (parsedPayload) {
          const edited = parseEditedNote(parsedPayload)
          return {
            ...edited,
            model,
          }
        }
      } catch (error) {
        lastError = error
        console.warn(
          `Cloudflare AI note edit failed for model ${model}${useJsonSchema ? ' (json schema)' : ''}`,
          error,
        )
      }
    }
  }

  console.error('Cloudflare AI note edit failed for all models', lastError)
  throw new Error('تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول لاحقاً.')
}
