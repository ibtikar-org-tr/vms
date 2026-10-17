-- The application already writes event_tickets.updated_at on UPDATE.
-- A same-row AFTER UPDATE trigger can abort D1 writes (including raising quantity).

DROP TRIGGER IF EXISTS update_event_ticket_updated_at;
