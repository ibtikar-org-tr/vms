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
