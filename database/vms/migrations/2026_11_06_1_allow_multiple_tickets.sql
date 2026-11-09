-- Per-event setting: 1 = a person may hold more than one ticket type, 0 = one ticket only.
-- Fresh installs that bootstrap from current main.sql should mark this migration as applied instead of running it.

ALTER TABLE events ADD COLUMN allow_multiple_tickets INTEGER NOT NULL DEFAULT 0;
