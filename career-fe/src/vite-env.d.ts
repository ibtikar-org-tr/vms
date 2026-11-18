/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_TARGET?: string
  readonly VITE_VMS_LOGIN_URL?: string
  /** Optional public career site origin used in PDF QR links (defaults to window.location.origin). */
  readonly VITE_CAREER_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
