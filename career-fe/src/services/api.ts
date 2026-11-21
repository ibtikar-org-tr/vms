import axios from 'axios'
import { clearSession, getAccessToken } from '../lib/auth-session'

const API_BASE_URL = import.meta.env.VITE_API_TARGET || 'http://localhost:9690/ms/career'

const api = axios.create({
  baseURL: API_BASE_URL + '/api',
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url ?? '')
    const isExchange = url.includes('/auth/vms/exchange')
    if (error.response?.status === 401 && !isExchange) {
      clearSession()
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/login?next=${next}`
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  exchangeVmsCode: async (code: string, redirectUri: string) => {
    const { data } = await api.post('/auth/vms/exchange', { code, redirectUri })
    return data as {
      access_token: string
      user: { membershipNumber: string; email: string; role: string }
    }
  },
  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },
}

export const profilesApi = {
  me: async () => (await api.get('/profiles/me')).data,
  updateMe: async (payload: {
    headline?: string | null
    summary?: string | null
    is_published?: boolean
    can_relocate?: boolean
    relocate_notes?: string | null
  }) => (await api.patch('/profiles/me', payload)).data,
  updateLanguages: async (
    languages: Array<{ language: string; proficiency?: number | null; openToTranslate?: boolean }>,
  ) => (await api.put('/profiles/me/languages', { languages })).data,
  updateWorkPreferences: async (payload: {
    canRelocate?: boolean
    relocateNotes?: string | null
    jobTypes?: Array<'full_time' | 'part_time' | 'temp_full_time'>
    locations?: Array<{
      kind: 'remote' | 'country'
      countryName?: string | null
      salaryMin?: number | null
      salaryMax?: number | null
      currency?: string | null
    }>
  }) => (await api.put('/profiles/me/work-preferences', payload)).data,
  memberSkills: async () => (await api.get('/profiles/me/skills')).data,
  addWork: async (payload: Record<string, unknown>) =>
    (await api.post('/profiles/me/work-experiences', payload)).data,
  updateWork: async (id: string, payload: Record<string, unknown>) =>
    (await api.patch(`/profiles/me/work-experiences/${id}`, payload)).data,
  deleteWork: async (id: string) => (await api.delete(`/profiles/me/work-experiences/${id}`)).data,
  addProject: async (payload: Record<string, unknown>) =>
    (await api.post('/profiles/me/projects', payload)).data,
  deleteProject: async (id: string) => (await api.delete(`/profiles/me/projects/${id}`)).data,
  uploadDocument: async (file: File, kind = 'cv') => {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    const { data } = await api.post('/profiles/me/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  deleteDocument: async (id: string) => (await api.delete(`/profiles/me/documents/${id}`)).data,
  documentDownloadUrl: (id: string) => `${API_BASE_URL}/api/profiles/me/documents/${id}/download`,
  publicDocumentDownloadUrl: (membershipNumber: string, id: string) =>
    `${API_BASE_URL}/api/profiles/${encodeURIComponent(membershipNumber)}/documents/${id}/download`,
  discover: async (q?: string) =>
    (await api.get('/profiles/discover', { params: q ? { q } : undefined })).data,
  getPublic: async (membershipNumber: string) =>
    (await api.get(`/profiles/${encodeURIComponent(membershipNumber)}`)).data,
  requestCvAccess: async (membershipNumber: string, message?: string) =>
    (
      await api.post(`/profiles/${encodeURIComponent(membershipNumber)}/access-requests`, {
        message,
      })
    ).data,
  listAccessRequests: async () => (await api.get('/profiles/me/access-requests')).data,
  decideAccessRequest: async (id: string, status: 'accepted' | 'rejected' | 'revoked') =>
    (await api.patch(`/profiles/me/access-requests/${encodeURIComponent(id)}`, { status })).data,
}

export function authDownloadHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
