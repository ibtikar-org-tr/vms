import {
  aiGeneratedTaskSchema,
  TASK_AI_DEFAULT_MODEL,
  type AiGeneratedTask,
  type TaskAiModelId,
} from '../schemas/vms-ai-task.schema'
import type { AppBindings } from '../types/bindings'
import { buildProjectRagContext } from './note-rag.service'

const JSON_MODE_MODELS = new Set<string>([
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/ibm-granite/granite-4.0-h-micro',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/deepseek-ai/deepseek-v4-flash-0731',
])

const TASK_JSON_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    subtasks: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['name', 'priority', 'subtasks'],
} as const

const SYSTEM_PROMPT = `You are a project management assistant for Ibtikar Assembly (تجمّع إبتكار), a volunteer student community platform.
The user will describe work they need done. You must break it into one parent task and practical subtasks.

Rules:
- Use the same language as the user's prompt (Arabic, English, or Turkish).
- When not using structured output, respond with valid JSON only (no markdown or code fences).
- "name": short task title (max 160 chars).
- "description": clear summary of goals and acceptance criteria (optional string).
- "priority": one of "low", "medium", "high".
- "subtasks": array of 3–8 actionable subtask titles (each max 160 chars), ordered logically.
- Subtasks must be concrete steps, not duplicates of the parent task title.
- You may receive project notes/tasks rosters and related project context retrieved by similarity. Use them to align the new task with existing work, avoid duplicate tasks, and reflect project decisions — but invent a fresh task for the user's request, not a copy of an existing one.`

interface CloudflareAiBinding {
  run(
    model: string,
    inputs: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      max_tokens?: number
      temperature?: number
      response_format?: {
        type: 'json_schema'
        json_schema: typeof TASK_JSON_SCHEMA
      }
    },
  ): Promise<{ response?: unknown }>
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
    if ('name' in record && 'subtasks' in record) {
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

function parseGeneratedTask(payload: unknown, model: string): AiGeneratedTask {
  const result = aiGeneratedTaskSchema.safeParse({
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
    model,
  })
  if (!result.success) {
    throw new Error('استجابة الذكاء الاصطناعي غير صالحة. حاول صياغة الطلب بشكل أوضح.')
  }

  return result.data
}

export async function generateTaskFromPrompt(
  env: AppBindings,
  prompt: string,
  projectContext: {
    projectId: string
    projectName?: string | null
    projectDescription?: string | null
    model?: TaskAiModelId | null
  },
): Promise<AiGeneratedTask> {
  const ai = env.AI as CloudflareAiBinding | undefined
  if (!ai) {
    throw new Error('خدمة الذكاء الاصطناعي غير متوفرة حالياً.')
  }

  const model = projectContext.model ?? TASK_AI_DEFAULT_MODEL

  const rag = await buildProjectRagContext(env, {
    projectId: projectContext.projectId,
    queryText: prompt,
    includeTaskRoster: true,
  })

  const contextLines: string[] = []
  if (projectContext.projectName?.trim()) {
    contextLines.push(`Project name: ${projectContext.projectName.trim()}`)
  }
  if (projectContext.projectDescription?.trim()) {
    contextLines.push(`Project description: ${projectContext.projectDescription.trim()}`)
  }

  const contextBlocks = [rag.noteRosterBlock, rag.taskRosterBlock, rag.relatedContextBlock]
    .filter(Boolean)
    .join('\n\n')

  const contextSection = contextBlocks ? `${contextBlocks}\n\n` : ''
  const projectHeader = contextLines.length > 0 ? `${contextLines.join('\n')}\n\n` : ''

  const userMessage = `${projectHeader}${contextSection}User request:
${prompt.trim()}`

  const useJsonSchemaAttempts = JSON_MODE_MODELS.has(model) ? [true, false] : [false]
  let lastError: unknown

  for (const useJsonSchema of useJsonSchemaAttempts) {
    try {
      const inputs: Parameters<CloudflareAiBinding['run']>[1] = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1200,
        temperature: 0.4,
      }

      if (useJsonSchema) {
        inputs.response_format = {
          type: 'json_schema',
          json_schema: TASK_JSON_SCHEMA,
        }
      }

      const response = await ai.run(model, inputs)
      const parsedPayload = normalizeAiResponsePayload(response)
      if (parsedPayload) {
        return parseGeneratedTask(parsedPayload, model)
      }
    } catch (error) {
      lastError = error
      console.warn(
        `Cloudflare AI task generation failed for model ${model}${useJsonSchema ? ' (json schema)' : ''}`,
        error,
      )
    }
  }

  console.error(`Cloudflare AI task generation failed for model ${model}`, lastError)
  throw new Error('تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول لاحقاً.')
}
