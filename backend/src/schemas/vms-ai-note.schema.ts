import { z } from 'zod'
import { projectNoteContentTypeSchema } from './vms-project-note.schema'

const requiredTrimmedString = z.string().trim().min(1)

/** Allowed Workers AI models for project-note AI edits. */
export const NOTE_AI_MODEL_IDS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/ibm-granite/granite-4.0-h-micro',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/deepseek-ai/deepseek-v4-flash-0731',
] as const

export type NoteAiModelId = (typeof NOTE_AI_MODEL_IDS)[number]

export const NOTE_AI_DEFAULT_MODEL: NoteAiModelId = NOTE_AI_MODEL_IDS[0]

export const noteAiModelIdSchema = z.enum(NOTE_AI_MODEL_IDS)

export const editNoteWithAiSchema = z.object({
  command: requiredTrimmedString.max(2000),
  content: z.string().max(80_000),
  contentType: projectNoteContentTypeSchema,
  model: noteAiModelIdSchema.optional().default(NOTE_AI_DEFAULT_MODEL),
})

export const aiEditedNoteSchema = z.object({
  content: z.string().max(80_000),
  summary: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1).max(160).optional(),
})

export type EditNoteWithAiInput = z.infer<typeof editNoteWithAiSchema>
export type AiEditedNote = z.infer<typeof aiEditedNoteSchema>
