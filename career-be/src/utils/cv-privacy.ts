/** First letter of each word, e.g. "أحمد علي حسن" → "أ. ع. ح." */
export function toInitialsLabel(value?: string | null): string | null {
  if (!value?.trim()) return null
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const ch = Array.from(word)[0]
      return ch ? `${ch}.` : ''
    })
    .filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

export type CvAccessStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'revoked' | 'self'

export function redactVmsProfile<T extends Record<string, unknown> | null | undefined>(
  vms: T,
): T {
  if (!vms || typeof vms !== 'object') return vms
  const source = vms as Record<string, unknown>
  return {
    ...source,
    email: null,
    phoneNumber: null,
    profilePictureUrl: null,
    enName: toInitialsLabel(typeof source.enName === 'string' ? source.enName : null),
    arName: toInitialsLabel(typeof source.arName === 'string' ? source.arName : null),
    // sex always kept
  } as T
}

export function redactWorkExperiences<T extends { company_name?: string | null }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    company_name: toInitialsLabel(row.company_name) || row.company_name,
  }))
}

export function redactProjects<T extends { company?: string | null }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    company: row.company ? toInitialsLabel(row.company) : row.company,
  }))
}

export function redactDocuments<
  T extends { file_name: string; kind?: string; content_type?: string | null; id: string },
>(rows: T[]): Array<Omit<T, 'file_name'> & { file_name: string; downloadable: false }> {
  return rows.map((row) => ({
    ...row,
    file_name:
      row.kind === 'cv' ? 'سيرة ذاتية (محمية)' : row.kind === 'portfolio' ? 'ملف أعمال (محمي)' : 'مرفق (محمي)',
    downloadable: false as const,
  }))
}
