import type { D1DatabaseLike } from '../types/bindings'
import { randomToken, sha256Hex } from '../utils/crypto'

const EXTERNAL_AUTH_CODE_TTL_SECONDS = 60

interface ExternalAuthCodeRow {
  id: string
  code_hash: string
  membership_number: string
  redirect_uri: string
  client_id: string | null
  expires_at: string
  consumed_at: string | null
}

export interface ExternalAuthCodeRecord {
  id: string
  code: string
  membershipNumber: string
  redirectUri: string
  clientId: string | null
  expiresAt: string
}

function expiresAtIso(): string {
  return new Date(Date.now() + EXTERNAL_AUTH_CODE_TTL_SECONDS * 1000).toISOString()
}

export async function createExternalAuthCode(
  db: D1DatabaseLike,
  input: {
    membershipNumber: string
    redirectUri: string
    clientId?: string | null
  },
): Promise<ExternalAuthCodeRecord> {
  const id = crypto.randomUUID()
  const code = randomToken(32)
  const codeHash = await sha256Hex(code)
  const expiresAt = expiresAtIso()
  const clientId = input.clientId?.trim() || null

  await db
    .prepare(
      `INSERT INTO external_auth_codes (
        id, code_hash, membership_number, redirect_uri, client_id, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, codeHash, input.membershipNumber, input.redirectUri, clientId, expiresAt)
    .run()

  return {
    id,
    code,
    membershipNumber: input.membershipNumber,
    redirectUri: input.redirectUri,
    clientId,
    expiresAt,
  }
}

export async function consumeExternalAuthCode(
  db: D1DatabaseLike,
  code: string,
): Promise<ExternalAuthCodeRow | null> {
  const codeHash = await sha256Hex(code)

  const row = await db
    .prepare(
      `SELECT id, code_hash, membership_number, redirect_uri, client_id, expires_at, consumed_at
       FROM external_auth_codes
       WHERE code_hash = ?
       LIMIT 1`,
    )
    .bind(codeHash)
    .first<ExternalAuthCodeRow>()

  if (!row || row.consumed_at) {
    return null
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null
  }

  await db
    .prepare(`UPDATE external_auth_codes SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL`)
    .bind(row.id)
    .run()

  return row
}
