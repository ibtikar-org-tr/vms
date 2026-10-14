import type { Context } from 'hono'

export function jsonValidationHook(result: { success: boolean; error?: { issues?: Array<{ path?: ReadonlyArray<unknown>; message?: string }> } }, c: Context) {
  if (result.success) {
    return
  }

  const issue = result.error?.issues?.[0]
  const path = issue?.path?.length ? issue.path.map(String).join('.') : null
  const message = issue?.message?.trim() || 'Invalid request.'

  return c.json({ error: path ? `${path}: ${message}` : message }, 400)
}
