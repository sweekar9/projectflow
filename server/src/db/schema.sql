-- ProjectFlow schema
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  key         TEXT NOT NULL,                 -- short prefix e.g. "PF"
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MEMBERSHIPS (RBAC is scoped per-project) -----------------------------------
-- role: owner | admin | member | viewer
CREATE TABLE IF NOT EXISTS memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- SPRINTS (Scrum) ------------------------------------------------------------
-- status: planned | active | completed
CREATE TABLE IF NOT EXISTS sprints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  goal       TEXT,
  status     TEXT NOT NULL DEFAULT 'planned',
  start_date DATE,
  end_date   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TASKS ----------------------------------------------------------------------
-- status: backlog | todo | in_progress | in_review | done  (Kanban columns)
-- type: story | task | bug
-- priority: low | medium | high | urgent
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id    UUID REFERENCES sprints(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog',
  type         TEXT NOT NULL DEFAULT 'task',
  priority     TEXT NOT NULL DEFAULT 'medium',
  story_points INTEGER,
  assignee_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,     -- ordering within a column
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMMENTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ATTACHMENTS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploader_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,                 -- stored filename on disk
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY (audit / history) -------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verb       TEXT NOT NULL,                    -- e.g. "created", "moved", "commented"
  entity     TEXT NOT NULL,                    -- e.g. "task", "sprint"
  entity_id  UUID,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint      ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_user  ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_proj   ON activities(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_usr ON notifications(user_id, is_read, created_at DESC);
