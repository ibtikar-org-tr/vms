-- Retry state for failed assembly broadcast recipients.
-- Fresh installs that bootstrap from current main.sql should mark this migration as applied instead of running it.

ALTER TABLE assembly_announcements ADD COLUMN retry_channel TEXT;
ALTER TABLE assembly_announcements ADD COLUMN retry_started_at TEXT;
ALTER TABLE assembly_announcement_failures ADD COLUMN attempted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_assembly_announcement_failures_retry
    ON assembly_announcement_failures(announcement_id, channel, attempted_at);
