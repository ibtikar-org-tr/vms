CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    description TEXT,
    parent_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL, -- allows for nesting projects, technically the whole application can be one big project with multiple levels of sub-projects
    owner TEXT NOT NULL, -- membership_number of the user who owns the project (canonical single-owner pointer; also mirrored in project_members as role=owner)
    telegram_group_id TEXT, -- Telegram group ID for project communication (e.g., "-123456789"); the same group may be linked to multiple projects
    status TEXT NOT NULL, -- "active", "completed", "archived"
    last_reported_at TEXT -- ISO 8601; last owner daily report sent (cron)
);

-- This will be handled in the backend to avoid sql looping
-- CREATE TRIGGER IF NOT EXISTS update_project_updated_at AFTER UPDATE ON projects
-- BEGIN
--     UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
-- END;

CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    role TEXT NOT NULL, -- "owner", "member", "manager", "observer" (exactly one owner per project; mirrored from projects.owner)
    PRIMARY KEY (project_id, membership_number)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT, -- MarkdownV2 formatted description
    created_by TEXT NOT NULL, -- membership_number of the user who created the position
    seats INTEGER NOT NULL DEFAULT 1, -- number of available seats for this position
    status TEXT NOT NULL -- "open", "filled", "closed"
);

CREATE TABLE IF NOT EXISTS position_applications (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL, -- membership_number of the user who applied for the position
    motivation_letter TEXT, -- user's motivation for applying to the position
    status TEXT NOT NULL, -- "pending", "accepted", "rejected"
    reviewed_by TEXT -- membership_number of the user who reviewed the application and made the decision
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL, -- membership_number of the user who created the task
    status TEXT NOT NULL, -- "open", "in_progress", "completed", "archived"
    priority TEXT NOT NULL DEFAULT 'medium', -- "low", "medium", "high"
    due_date TEXT, -- stored as ISO 8601 string (e.g., "1990-01-01")
    points INTEGER NOT NULL DEFAULT 0,
    assigned_to TEXT, -- membership_number of the user assigned to the task
    completed_by TEXT, -- membership_number of the user who marked the task as completed
    completed_at TEXT, -- stored as ISO 8601 string (e.g., "1990-01-01T12:00:00Z")
    -- completion_approval_status TEXT NOT NULL DEFAULT 'pending' -- "pending", "approved", "rejected" (removed for simplicity, now the task completion depends on the approved_by field)
    approved_by TEXT, -- membership_number of the user who approved the task completion (set when approved, rejection will reset the completed_by and completed_at fields to NULL)
    last_reminded_at TEXT -- ISO 8601; last task reminder sent to assignee (cron)
);

CREATE TRIGGER IF NOT EXISTS update_task_updated_at AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS points_transactions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    membership_number TEXT NOT NULL, -- membership_number of the user whose points are being changed
    task_id TEXT, -- task_id associated with the points change (can be NULL for non-task-related transactions)
    amount INTEGER NOT NULL,
    type TEXT NOT NULL -- "task_reward", "task_reward_reversal", "purchase", "event_attendance", "other"
);

CREATE TRIGGER IF NOT EXISTS update_points_transaction_updated_at AFTER UPDATE ON points_transactions
BEGIN
    UPDATE points_transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    description TEXT,
    start_time TEXT, -- stored as ISO 8601 string (e.g., "1990-01-01T12:00:00Z")
    end_time TEXT, -- stored as ISO 8601 string (e.g., "1990-01-01T12:00:00Z")
    image_url TEXT, -- banner image URL associated with the event (e.g., "https://example.com/banner.jpg")
    associated_urls TEXT, -- JSON array of URLs associated with the event (e.g., {"website": "https://example.com", "facebook": "https://facebook.com/example", "map": "https://www.openstreetmap.org/relation/1661399"})
    created_by TEXT NOT NULL, -- membership_number of the user who created the event
    project_id TEXT NOT NULL REFERENCES projects(id), -- association with a project
    status TEXT NOT NULL, -- "draft","public","archived"
    country TEXT, -- ISO 3166-1 alpha-2 country code (e.g., "US", "TR", etc.)
    region TEXT, -- state/region or province within the country (e.g., "Istanbul", "Aleppo", "California" etc.)
    city TEXT, -- city of residence (e.g., "Fatih", "Al Bab", "Mezitli", "Azaz" etc.)
    address TEXT, -- detailed address for the event location (e.g., "123 Main St, Building A, Door 4") | can be "online" for online events
    telegram_group_id TEXT, -- Telegram group ID for event communication (e.g., "-123456789"); the same group may be linked to multiple events
    display_attendee_numbers INTEGER NOT NULL DEFAULT 1, -- 1 = show attendee counts publicly, 0 = hide from non-managers
    cancellation_deadline_hours INTEGER NOT NULL DEFAULT 48, -- hours before start_time when self-cancellation closes; 0 = disabled
    allow_guest_registration INTEGER NOT NULL DEFAULT 0, -- 1 = unauthenticated visitors may register with name/email/phone
    registration_success_message TEXT -- optional rich text shown to the registrant after a successful apply
);

CREATE TRIGGER IF NOT EXISTS update_event_updated_at AFTER UPDATE ON events
BEGIN
    UPDATE events SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS event_tickets ( -- the available tickets for the events, 
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    point_price INTEGER NOT NULL, -- price in points (can be 0 for free tickets, negative for rewarding points to participants, and positive for charging points from participants)
    currency_price TEXT, -- price in currency (e.g., 10 $USD, 250 TRY, 10000 SYP, etc.)
    quantity INTEGER NOT NULL, -- total quantity of this ticket type available for the event
    active_registration_count INTEGER NOT NULL DEFAULT 0 -- denormalized count of registrations with status registered or attended
);

CREATE TRIGGER IF NOT EXISTS update_event_ticket_updated_at AFTER UPDATE ON event_tickets
BEGIN
    UPDATE event_tickets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS event_registrations ( -- one row per ticket type; a person may hold multiple tickets for the same event
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    membership_number TEXT, -- membership_number of the user who registered; NULL until a guest email is claimed on signup
    ticket_id TEXT NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- "registered", "attended", "cancelled", "no_show"
    payment_approved_by TEXT, -- membership_number of the user who approved the payment (e.g., "1234567890")
    attendance_approved_by TEXT, -- membership_number of the user who approved the attendance status (e.g., marking as attended, marking as no_show etc.)
    guest_email TEXT, -- lowercased email for unauthenticated registrations; kept as a snapshot after claim
    guest_name TEXT,
    guest_phone TEXT
);

CREATE TRIGGER IF NOT EXISTS update_event_registration_updated_at AFTER UPDATE ON event_registrations
BEGIN
    UPDATE event_registrations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_event_member_ticket
    ON event_registrations (event_id, membership_number, ticket_id)
    WHERE membership_number IS NOT NULL AND status IN ('registered', 'attended');

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_event_guest_email_ticket
    ON event_registrations (event_id, guest_email, ticket_id)
    WHERE guest_email IS NOT NULL AND status IN ('registered', 'attended');

CREATE INDEX IF NOT EXISTS idx_event_registrations_guest_email
    ON event_registrations (guest_email)
    WHERE guest_email IS NOT NULL AND membership_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_member
    ON event_registrations (event_id, membership_number)
    WHERE membership_number IS NOT NULL;


CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- skill name, must be lowercase, without spaces and latin characters only (e.g., "python", "project_management", "design")
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT,
    members INT, -- number of members who have this skill
    events INT, -- number of events that require or recommend this skill
    tasks INT -- number of tasks that require this skill
);

CREATE TRIGGER IF NOT EXISTS update_skill_updated_at AFTER UPDATE ON skills
BEGIN
    UPDATE skills SET updated_at = datetime('now') WHERE name = NEW.name;
END;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);

CREATE TABLE IF NOT EXISTS skills_association (
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    associated_id TEXT NOT NULL, -- can be project_id, event_id, task_id, position_id, club_id
    associated_type TEXT NOT NULL CHECK (associated_type IN ('project', 'event', 'task', 'position', 'club')),
    skill_level TEXT CHECK (skill_level IN ('required', 'recommended', 'aquired')),
    PRIMARY KEY (skill_id, associated_id)
);

CREATE INDEX IF NOT EXISTS idx_skills_association_skill_id ON skills_association(skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_association_associated_id ON skills_association(associated_id);

CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id), -- every clubs is associated with a project
    image_url TEXT, -- banner image URL associated with the club (e.g., "https://example.com/banner.jpg")
    country TEXT, -- ISO 3166-1 alpha-2 country code (e.g., "US", "TR", etc.)
    region TEXT, -- state/region or province within the country (e.g., "Istanbul", "Aleppo", "California" etc.)
    city TEXT, -- city of residence (e.g., "Fatih", "Al Bab", "Mezitli", "Azaz" etc.)
    address TEXT, -- detailed address for the club location (e.g., "123 Main St, Building A, Door 4") | can be "online" for online events
    visibility TEXT NOT NULL, -- "public", "private", "draft"
    join_policy TEXT NOT NULL, -- "auto_approve", "request_to_join", "invite_only"
    telegram_group_id TEXT -- Telegram group ID for the club (e.g., "-123456789"); the same group may be linked to multiple clubs
);

CREATE INDEX IF NOT EXISTS idx_clubs_project ON clubs(project_id);

CREATE TABLE IF NOT EXISTS club_members (
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    status TEXT NOT NULL, -- "active", "pending", "rejected"
    PRIMARY KEY (club_id, membership_number)
);

CREATE INDEX IF NOT EXISTS idx_club_members_membership_number ON club_members(membership_number);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_status ON club_members(status);

CREATE TABLE IF NOT EXISTS project_notes (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    content_preview TEXT,
    content_type TEXT NOT NULL DEFAULT 'html', -- "html" | "markdown"
    created_by TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS update_project_note_updated_at AFTER UPDATE ON project_notes
BEGIN
    UPDATE project_notes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);

CREATE TABLE IF NOT EXISTS task_subtasks (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    parent_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- "open", "completed"
    completed_at TEXT,
    completed_by TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS update_task_subtask_updated_at AFTER UPDATE ON task_subtasks
BEGIN
    UPDATE task_subtasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_task_subtasks_parent ON task_subtasks(parent_task_id);
