export function createId(prefix?: string): string {
  const id = crypto.randomUUID()
  return prefix ? `${prefix}_${id}` : id
}

export function nowIso(): string {
  return new Date().toISOString()
}
