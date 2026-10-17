ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

UPDATE users SET email_verified = 1;

CREATE TABLE IF NOT EXISTS signup_intents (
    jti TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram')),
    email TEXT,
    telegram_id TEXT,
    telegram_username TEXT,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_signup_intents_email ON signup_intents (email);
CREATE INDEX IF NOT EXISTS idx_signup_intents_telegram_id ON signup_intents (telegram_id);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    jti TEXT PRIMARY KEY,
    membership_number TEXT NOT NULL,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_membership
    ON email_verification_tokens (membership_number);
