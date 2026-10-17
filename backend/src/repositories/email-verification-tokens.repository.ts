import type { D1DatabaseLike } from '../types/bindings'

export async function insertEmailVerificationToken(
  db: D1DatabaseLike,
  params: {
    jti: string
    membershipNumber: string
    email: string
    expiresAt: string
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO email_verification_tokens (jti, membership_number, email, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(params.jti, params.membershipNumber, params.email, params.expiresAt)
    .run()
}

export async function consumeEmailVerificationToken(db: D1DatabaseLike, jti: string): Promise<boolean> {
  const result = (await db
    .prepare(
      `UPDATE email_verification_tokens
       SET consumed_at = datetime('now')
       WHERE jti = ?
         AND consumed_at IS NULL
         AND datetime(expires_at) > datetime('now')`,
    )
    .bind(jti)
    .run()) as { meta?: { changes?: number } }

  return (result.meta?.changes ?? 0) > 0
}
