-- Event attendee ratings: manager settings + fields + unlinkable anonymous ratings.

ALTER TABLE events ADD COLUMN ratings_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN ratings_require_attendance_approved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN ratings_deadline_at TEXT;

CREATE TABLE IF NOT EXISTS event_rating_fields (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- text, textarea, email, phone, url, number
    required INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_rating_fields_event
    ON event_rating_fields (event_id, sort_order);

CREATE TABLE IF NOT EXISTS event_ratings (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score INTEGER NOT NULL, -- 1..10
    feedback TEXT,
    answers TEXT NOT NULL -- JSON array of { fieldId, label, value }
);

CREATE INDEX IF NOT EXISTS idx_event_ratings_event
    ON event_ratings (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_rating_raters (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    rating_id TEXT REFERENCES event_ratings(id) ON DELETE SET NULL -- NULL when identity is hidden
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rating_raters_event_member
    ON event_rating_raters (event_id, membership_number);

CREATE INDEX IF NOT EXISTS idx_event_rating_raters_rating
    ON event_rating_raters (rating_id)
    WHERE rating_id IS NOT NULL;
