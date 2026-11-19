CREATE TABLE entity_skills (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (entity_type, entity_id, skill_id)
);

CREATE INDEX idx_entity_skills_entity ON entity_skills (entity_type, entity_id);
CREATE INDEX idx_entity_skills_member ON entity_skills (membership_number);
