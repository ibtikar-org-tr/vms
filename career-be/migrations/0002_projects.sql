CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  project_type TEXT,
  company TEXT,
  start_date TEXT,
  end_date TEXT,
  is_ongoing INTEGER NOT NULL DEFAULT 0,
  tools TEXT,
  responsibilities TEXT,
  outcomes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_projects_member ON projects (membership_number);

ALTER TABLE work_experiences ADD COLUMN responsibilities TEXT;
ALTER TABLE work_experiences ADD COLUMN achievements TEXT;
