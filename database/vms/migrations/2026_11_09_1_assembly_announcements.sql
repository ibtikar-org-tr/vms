-- Broadcast history for assembly-wide Telegram and email messages.
-- Fresh installs that bootstrap from current main.sql should mark this migration as applied instead of running it.

CREATE TABLE IF NOT EXISTS assembly_announcements (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
    last_error TEXT
);

CREATE TRIGGER IF NOT EXISTS update_assembly_announcement_updated_at AFTER UPDATE ON assembly_announcements
BEGIN
    UPDATE assembly_announcements SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_assembly_announcements_created_at ON assembly_announcements(created_at);
