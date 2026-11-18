CREATE TABLE career_profiles (
  membership_number TEXT PRIMARY KEY,
  headline TEXT,
  summary TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE work_experiences (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_work_experiences_member ON work_experiences (membership_number);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  membership_number TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (membership_number) REFERENCES career_profiles(membership_number) ON DELETE CASCADE
);

CREATE INDEX idx_documents_member ON documents (membership_number);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  created_by_membership_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE company_members (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  membership_number TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, membership_number),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_company_members_member ON company_members (membership_number);

CREATE TABLE company_invites (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  membership_number TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by_membership_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, membership_number),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_company_invites_member ON company_invites (membership_number);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  employment_type TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by_membership_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_jobs_company ON jobs (company_id);
CREATE INDEX idx_jobs_status ON jobs (status);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  membership_number TEXT NOT NULL,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (job_id, membership_number),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_applications_member ON applications (membership_number);
CREATE INDEX idx_applications_job ON applications (job_id);
