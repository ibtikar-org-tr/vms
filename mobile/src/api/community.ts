import { apiGetJson, apiPostJson } from '@/src/api/client'
import type {
  VmsLeaderboardEntry,
  VmsLeaderboardViewer,
  VmsPosition,
  VmsPositionApplication,
} from '@/src/types/community'

export function fetchOpenPositions() {
  return apiGetJson<{ positions: VmsPosition[] }>('/positions')
}

export function createPositionApplication(
  positionId: string,
  payload: { motivationLetter?: string } = {},
) {
  return apiPostJson<{ positionApplication: VmsPositionApplication }, typeof payload>(
    `/positions/${encodeURIComponent(positionId)}/applications`,
    payload,
  )
}

export function selfCancelPositionApplication(applicationId: string) {
  return apiPostJson<{ message: string }, Record<string, never>>(
    `/position-applications/${encodeURIComponent(applicationId)}/self-cancel`,
    {},
  )
}

export function fetchLeaderboard() {
  return apiGetJson<{ entries: VmsLeaderboardEntry[]; viewer: VmsLeaderboardViewer | null }>(
    '/leaderboard',
  )
}
