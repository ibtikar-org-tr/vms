export interface D1PreparedStatementResultLike {
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementResultLike
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike
}

export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | ReadableStream<Uint8Array> | string): Promise<R2Object>
  get(key: string): Promise<R2ObjectBody | null>
  delete(key: string): Promise<void>
}

export interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  checksums: Record<string, string>
  uploaded: Date
  httpMetadata: R2HttpMetadata
  customMetadata: Record<string, string>
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>
  bodyUsed: boolean
}

export interface R2HttpMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  expires?: Date
}

export interface DurableObjectNamespaceLike<T = unknown> {
  idFromName(name: string): DurableObjectIdLike
  get(id: DurableObjectIdLike): DurableObjectStubLike<T>
  getByName(name: string): DurableObjectStubLike<T>
}

export interface DurableObjectIdLike {
  toString(): string
}

export interface DurableObjectStubLike<T = unknown> {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
  id: DurableObjectIdLike
}

export interface CloudflareAiBindingLike {
  run(
    model: string,
    inputs:
      | {
          messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
          max_tokens?: number
          temperature?: number
          response_format?: {
            type: 'json_schema'
            json_schema: Record<string, unknown>
          }
        }
      | {
          text: string[]
        },
  ): Promise<{ response?: unknown; data?: number[][] }>
}

export type VectorizeMetadataValue = string | number | boolean | null

export interface VectorizeVectorLike {
  id: string
  values: number[] | Float32Array
  metadata?: Record<string, VectorizeMetadataValue>
}

export interface VectorizeMatchLike {
  id: string
  score: number
  metadata?: Record<string, VectorizeMetadataValue>
}

export interface VectorizeBindingLike {
  upsert(vectors: VectorizeVectorLike[]): Promise<unknown>
  deleteByIds(ids: string[]): Promise<unknown>
  query(
    vector: number[],
    options?: {
      topK?: number
      returnMetadata?: 'none' | 'indexed' | 'all'
      filter?: Record<string, unknown>
    },
  ): Promise<{ matches: VectorizeMatchLike[] }>
}

export interface AppBindings {
  MEMBERS_DB: D1DatabaseLike
  VMS_DB: D1DatabaseLike
  VMS_LOGS_DB: D1DatabaseLike
  MY_BUCKET: R2BucketLike
  PROJECT_NOTE_ROOM: DurableObjectNamespaceLike
  AI?: CloudflareAiBindingLike
  VMS_NOTES_VECTORIZE?: VectorizeBindingLike
  TELEGRAM_MS_SERVICE?: Fetcher
  MEMBERSHIP_NUMBER_PREFIX: string
  SMTP_HOST: string
  SMTP_PORT: string | number
  SMTP_USER: string
  SMTP_PASS: string
  TELEGRAM_MS: string
  FRONTEND_BASE_URL: string
  /** Comma-separated list of allowed browser origins for CORS. */
  CORS_ALLOW_ORIGINS?: string
  INTERNAL_SECRET: string
  JWT_SECRET: string
  CRON_TIMEZONE?: string
  CRON_DRY_RUN?: string
}
