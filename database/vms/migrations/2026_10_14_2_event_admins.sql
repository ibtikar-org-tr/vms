CREATE TABLE IF NOT EXISTS event_admins (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, membership_number)
);

CREATE INDEX IF NOT EXISTS idx_event_admins_membership_number ON event_admins (membership_number);
