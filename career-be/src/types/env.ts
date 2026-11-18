export interface Environment {
  D1_DB: D1Database
  /** Shared with VMS — member accounts + user_skills */
  MEMBERS_DB: D1Database
  /** Shared with VMS — global skills taxonomy */
  VMS_DB: D1Database
  CAREER_BUCKET: R2Bucket
  APP_NAME: string
  JWT_SECRET?: string
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
