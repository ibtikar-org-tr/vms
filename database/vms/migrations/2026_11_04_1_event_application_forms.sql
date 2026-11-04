CREATE TABLE IF NOT EXISTS event_form_fields (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_form_fields_event
    ON event_form_fields (event_id, sort_order);

CREATE TABLE IF NOT EXISTS event_form_submissions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    membership_number TEXT,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    answers TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_form_submissions_event
    ON event_form_submissions (event_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_form_submissions_event_email
    ON event_form_submissions (event_id, applicant_email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_form_submissions_event_member
    ON event_form_submissions (event_id, membership_number)
    WHERE membership_number IS NOT NULL;
