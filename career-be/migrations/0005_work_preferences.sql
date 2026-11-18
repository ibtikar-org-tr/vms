ALTER TABLE career_profiles ADD COLUMN can_relocate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE career_profiles ADD COLUMN relocate_notes TEXT;

CREATE TABLE work_locations (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'remote' | 'country'
  country_name TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_work_locations_member ON work_locations (membership_number);
