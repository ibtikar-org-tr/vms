CREATE TABLE IF NOT EXISTS cron_notification_log (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL DEFAULT 'event_reminder',
    entity_type TEXT NOT NULL DEFAULT 'event',
    entity_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    reminder_kind TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_log_dedupe
    ON cron_notification_log (job_type, entity_type, entity_id, recipient, reminder_kind);

CREATE INDEX IF NOT EXISTS idx_cron_log_sent_at ON cron_notification_log (sent_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    membership_number TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_membership ON refresh_tokens (membership_number);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS used_password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    membership_number TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_used_password_reset_tokens_membership
    ON used_password_reset_tokens (membership_number);

CREATE INDEX IF NOT EXISTS idx_used_password_reset_tokens_expires
    ON used_password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    content_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS external_auth_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    membership_number TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    client_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    consumed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_auth_codes_hash ON external_auth_codes (code_hash);
CREATE INDEX IF NOT EXISTS idx_external_auth_codes_membership ON external_auth_codes (membership_number);
CREATE INDEX IF NOT EXISTS idx_external_auth_codes_expires ON external_auth_codes (expires_at);
