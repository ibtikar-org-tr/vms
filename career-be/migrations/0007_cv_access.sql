CREATE TABLE cv_access_requests (
  id TEXT PRIMARY KEY,
  owner_membership_number TEXT NOT NULL,
  requester_membership_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (owner_membership_number, requester_membership_number),
  FOREIGN KEY (owner_membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_cv_access_owner_status
  ON cv_access_requests (owner_membership_number, status);

CREATE INDEX idx_cv_access_requester
  ON cv_access_requests (requester_membership_number);
