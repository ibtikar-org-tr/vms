-- Totals and per-recipient failures for queued assembly broadcasts.
-- Fresh installs that bootstrap from current main.sql should mark this migration as applied instead of running it.

ALTER TABLE assembly_announcements ADD COLUMN email_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assembly_announcements ADD COLUMN telegram_total INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS assembly_announcement_failures (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    announcement_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    membership_number TEXT,
    email TEXT,
    display_name TEXT,
    error TEXT,
    FOREIGN KEY (announcement_id) REFERENCES assembly_announcements(id)
);

CREATE INDEX IF NOT EXISTS idx_assembly_announcement_failures_announcement
    ON assembly_announcement_failures(announcement_id);
