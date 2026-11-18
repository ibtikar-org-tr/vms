/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_TARGET?: string
  readonly VITE_VMS_LOGIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
