-- Broadcast history for event registrant Telegram and email messages.

CREATE TABLE IF NOT EXISTS event_announcements (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    send_email INTEGER NOT NULL DEFAULT 1,
    send_telegram INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    email_sent INTEGER NOT NULL DEFAULT 0,
    email_failed INTEGER NOT NULL DEFAULT 0,
    email_cursor INTEGER NOT NULL DEFAULT 0,
    telegram_sent INTEGER NOT NULL DEFAULT 0,
    telegram_failed INTEGER NOT NULL DEFAULT 0,
    email_total INTEGER NOT NULL DEFAULT 0,
    telegram_total INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    retry_channel TEXT,
    retry_started_at TEXT
);

CREATE TRIGGER IF NOT EXISTS update_event_announcement_updated_at AFTER UPDATE ON event_announcements
BEGIN
    UPDATE event_announcements SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_event_announcements_event_created
    ON event_announcements(event_id, created_at);

CREATE TABLE IF NOT EXISTS event_announcement_failures (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    announcement_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    membership_number TEXT,
    email TEXT,
    display_name TEXT,
    error TEXT,
    attempted_at TEXT,
    FOREIGN KEY (announcement_id) REFERENCES event_announcements(id)
);

CREATE INDEX IF NOT EXISTS idx_event_announcement_failures_announcement
    ON event_announcement_failures(announcement_id);

CREATE INDEX IF NOT EXISTS idx_event_announcement_failures_retry
    ON event_announcement_failures(announcement_id, channel, attempted_at);
