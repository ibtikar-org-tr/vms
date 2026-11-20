import {
  snapshotFromDraft,
  type LanguagePrefSnapshot,
  type ProfileDraftSnapshot,
} from './profile-changelog'
import { normalizeWorkPreferences, type WorkPreferences } from './work-preferences'

const STORAGE_PREFIX = 'career-cv-edit-draft-v1:'

export type CvEditLocalDraft = {
  version: 1
  savedAt: string
  membershipNumber: string
  summary: string
  languages: LanguagePrefSnapshot[]
  workPreferences: WorkPreferences
}

function storageKey(membershipNumber: string) {
  return `${STORAGE_PREFIX}${membershipNumber}`
}

export function readCvEditDraft(membershipNumber: string): CvEditLocalDraft | null {
  if (typeof window === 'undefined' || !membershipNumber) return null
  try {
    const raw = window.localStorage.getItem(storageKey(membershipNumber))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CvEditLocalDraft
    if (!parsed || parsed.version !== 1) return null
    return {
      version: 1,
      savedAt: String(parsed.savedAt || ''),
      membershipNumber,
      summary: String(parsed.summary || ''),
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      workPreferences: normalizeWorkPreferences(parsed.workPreferences),
    }
  } catch {
    return null
  }
}

export function writeCvEditDraft(
  membershipNumber: string,
  draft: {
    summary: string
    languages: LanguagePrefSnapshot[]
    workPreferences: WorkPreferences
  },
) {
  if (typeof window === 'undefined' || !membershipNumber) return
  const payload: CvEditLocalDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    membershipNumber,
    summary: draft.summary,
    languages: draft.languages,
    workPreferences: draft.workPreferences,
  }
  window.localStorage.setItem(storageKey(membershipNumber), JSON.stringify(payload))
}

export function clearCvEditDraft(membershipNumber: string) {
  if (typeof window === 'undefined' || !membershipNumber) return
  window.localStorage.removeItem(storageKey(membershipNumber))
}

export function draftSnapshot(draft: {
  summary: string
  languages: LanguagePrefSnapshot[]
  workPreferences: WorkPreferences
}): ProfileDraftSnapshot {
  return snapshotFromDraft(draft)
}

export function draftsDiffer(a: ProfileDraftSnapshot, b: ProfileDraftSnapshot) {
  return JSON.stringify(a) !== JSON.stringify(b)
}
