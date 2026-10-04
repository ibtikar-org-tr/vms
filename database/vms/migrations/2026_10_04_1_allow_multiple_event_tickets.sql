-- Allow one person to hold multiple ticket types for the same event.
-- Fresh installs bootstrapped from current main.sql should mark this migration as applied.

CREATE TABLE event_registrations_new (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    membership_number TEXT,
    ticket_id TEXT NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    payment_approved_by TEXT,
    attendance_approved_by TEXT,
    guest_email TEXT,
    guest_name TEXT,
    guest_phone TEXT
);

INSERT INTO event_registrations_new (
    id,
    created_at,
    updated_at,
    event_id,
    membership_number,
    ticket_id,
    status,
    payment_approved_by,
    attendance_approved_by,
    guest_email,
    guest_name,
    guest_phone
)
SELECT
    id,
    created_at,
    updated_at,
    event_id,
    membership_number,
    ticket_id,
    status,
    payment_approved_by,
    attendance_approved_by,
    guest_email,
    guest_name,
    guest_phone
FROM event_registrations;

DROP TABLE event_registrations;
ALTER TABLE event_registrations_new RENAME TO event_registrations;

CREATE TRIGGER IF NOT EXISTS update_event_registration_updated_at AFTER UPDATE ON event_registrations
BEGIN
    UPDATE event_registrations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_event_member_ticket
    ON event_registrations (event_id, membership_number, ticket_id)
    WHERE membership_number IS NOT NULL AND status IN ('registered', 'attended');

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_event_guest_email_ticket
    ON event_registrations (event_id, guest_email, ticket_id)
    WHERE guest_email IS NOT NULL AND status IN ('registered', 'attended');

CREATE INDEX IF NOT EXISTS idx_event_registrations_guest_email
    ON event_registrations (guest_email)
    WHERE guest_email IS NOT NULL AND membership_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_member
    ON event_registrations (event_id, membership_number)
    WHERE membership_number IS NOT NULL;
