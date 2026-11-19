-- Optional image attached to event and assembly broadcasts.

ALTER TABLE event_announcements ADD COLUMN image_url TEXT;
ALTER TABLE assembly_announcements ADD COLUMN image_url TEXT;
