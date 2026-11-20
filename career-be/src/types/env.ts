export interface Environment {
  D1_DB: D1Database
  /** Shared with VMS — member accounts + user_skills */
  MEMBERS_DB: D1Database
  /** Shared with VMS — global skills taxonomy */
  VMS_DB: D1Database
  CAREER_BUCKET: R2Bucket
  /** Service binding to membership-app-backend (preferred for same-zone calls). */
  MEMBERSHIP_MS_SERVICE?: Fetcher
  APP_NAME: string
  /** Fallback public/local membership API base, e.g. …/ms/membership-app/api */
  VMS_API_BASE?: string
  VMS_INTERNAL_SECRET?: string
}

export type CareerMember = {
  membership_number: string
  email: string
  vms_role: string
}

export type CareerVariables = {
  member: CareerMember
}

export type AppBindings = {
  Bindings: Environment
  Variables: CareerVariables
}
