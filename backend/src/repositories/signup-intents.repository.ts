import type { D1DatabaseLike } from '../types/bindings'

export type SignupChannel = 'email' | 'telegram'

export interface SignupIntentRow {
  jti: string
  channel: SignupChannel
  email: string | null
  telegram_id: string | null
  telegram_username: string | null
  expires_at: string
  consumed_at: string | null
}

export async function insertSignupIntent(
  db: D1DatabaseLike,
  params: {
    jti: string
    channel: SignupChannel
    email: string | null
    telegramId: string | null
    telegramUsername: string | null
    expiresAt: string
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO signup_intents (jti, channel, email, telegram_id, telegram_username, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.jti,
      params.channel,
      params.email,
      params.telegramId,
      params.telegramUsername,
      params.expiresAt,
    )
    .run()
}

export async function getSignupIntent(db: D1DatabaseLike, jti: string): Promise<SignupIntentRow | null> {
  return db
    .prepare(
      `SELECT jti, channel, email, telegram_id, telegram_username, expires_at, consumed_at
       FROM signup_intents
       WHERE jti = ?
       LIMIT 1`,
    )
    .bind(jti)
    .first<SignupIntentRow>()
}

export async function consumeSignupIntent(db: D1DatabaseLike, jti: string): Promise<boolean> {
  const result = (await db
    .prepare(
      `UPDATE signup_intents
       SET consumed_at = datetime('now')
       WHERE jti = ?
         AND consumed_at IS NULL
         AND datetime(expires_at) > datetime('now')`,
    )
    .bind(jti)
    .run()) as { meta?: { changes?: number } }

  return (result.meta?.changes ?? 0) > 0
}

export async function releaseSignupIntent(db: D1DatabaseLike, jti: string): Promise<void> {
  await db
    .prepare(`UPDATE signup_intents SET consumed_at = NULL WHERE jti = ?`)
    .bind(jti)
    .run()
}
