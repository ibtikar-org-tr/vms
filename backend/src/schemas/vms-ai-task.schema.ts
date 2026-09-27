import { z } from 'zod'
import {
  NOTE_AI_DEFAULT_MODEL,
  NOTE_AI_MODEL_IDS,
  noteAiModelIdSchema,
  type NoteAiModelId,
} from './vms-ai-note.schema'

const requiredTrimmedString = z.string().trim().min(1)

/** Same Workers AI allowlist as project-note AI edits. */
export const TASK_AI_MODEL_IDS = NOTE_AI_MODEL_IDS
export type TaskAiModelId = NoteAiModelId
export const TASK_AI_DEFAULT_MODEL = NOTE_AI_DEFAULT_MODEL
export const taskAiModelIdSchema = noteAiModelIdSchema

export const generateTaskWithAiSchema = z.object({
  projectId: requiredTrimmedString,
  prompt: requiredTrimmedString.max(4000),
  model: taskAiModelIdSchema.optional().default(TASK_AI_DEFAULT_MODEL),
})

export const aiGeneratedTaskSchema = z.object({
  name: requiredTrimmedString.max(160),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  subtasks: z.array(requiredTrimmedString.max(160)).max(20).default([]),
  model: z.string().trim().min(1).max(160).optional(),
})

export type GenerateTaskWithAiInput = z.infer<typeof generateTaskWithAiSchema>
export type AiGeneratedTask = z.infer<typeof aiGeneratedTaskSchema>
