-- Optional name/email/phone on event application forms (evaluation / rating).
-- Unique email only when an email is actually provided.

ALTER TABLE events ADD COLUMN require_applicant_contact INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS idx_event_form_submissions_event_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_form_submissions_event_email
    ON event_form_submissions (event_id, applicant_email)
    WHERE applicant_email IS NOT NULL AND applicant_email != '';
