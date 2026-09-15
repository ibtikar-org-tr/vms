/** Workers AI models available for project-note AI edits (must match backend schema). */
export const NOTE_AI_MODELS = [
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    label: 'Qwen3 30B',
    description: 'قوي ومتعدد اللغات',
  },
  {
    id: '@cf/ibm-granite/granite-4.0-h-micro',
    label: 'Granite 4.0 Micro',
    description: 'سريع واقتصادي · سياق كبير',
  },
  {
    id: '@cf/zai-org/glm-4.7-flash',
    label: 'GLM 4.7 Flash',
    description: 'سريع ومتعدد اللغات',
  },
  {
    id: '@cf/zai-org/glm-5.3-flash',
    label: 'GLM 5.3 Flash',
    description: 'أقوى · قد يتطلب خطة مدفوعة',
  },
  {
    id: '@cf/deepseek-ai/deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash',
    description: 'قدرات وكيلية عالية · قد يتطلب خطة مدفوعة',
  },
] as const

export type NoteAiModelId = (typeof NOTE_AI_MODELS)[number]['id']

export const NOTE_AI_DEFAULT_MODEL: NoteAiModelId = NOTE_AI_MODELS[0].id

/** @deprecated Use NOTE_AI_DEFAULT_MODEL */
export const NOTE_AI_PRIMARY_MODEL = NOTE_AI_DEFAULT_MODEL

export function isNoteAiModelId(value: string): value is NoteAiModelId {
  return NOTE_AI_MODELS.some((model) => model.id === value)
}
