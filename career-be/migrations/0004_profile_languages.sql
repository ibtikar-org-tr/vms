CREATE TABLE profile_languages (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  language_name TEXT NOT NULL,
  proficiency INTEGER,
  open_to_translate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (membership_number, language_name),
  FOREIGN KEY (membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_profile_languages_member ON profile_languages (membership_number);
