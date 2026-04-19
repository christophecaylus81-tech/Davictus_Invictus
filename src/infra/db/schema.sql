CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'next', 'in_progress', 'done', 'cancelled')),
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  user_id TEXT,
  external_ref TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'processed', 'archived', 'deleted')),
  gtd_bucket TEXT CHECK (gtd_bucket IN ('task', 'project', 'incubator', 'archive', 'trash')),
  classification_reason TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'blocks' CHECK (relation_type IN ('blocks', 'related')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (predecessor_task_id, successor_task_id, relation_type)
);

CREATE TABLE IF NOT EXISTS processing_logs (
  id BIGSERIAL PRIMARY KEY,
  inbox_item_id UUID NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credentials (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'api' CHECK (category IN ('api', 'oauth', 'webhook', 'other')),
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_users (
  chat_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Inconnu',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_chat_id TEXT NOT NULL,
  request_text TEXT NOT NULL,
  normalized_command TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('run_tests', 'code_task')),
  provider TEXT NOT NULL DEFAULT 'codex' CHECK (provider IN ('codex', 'claude', 'shell')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'blocked', 'cancelled')),
  repo_path TEXT,
  branch_name TEXT,
  worktree_path TEXT,
  summary TEXT,
  error_message TEXT,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_agent_job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES dev_agent_jobs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('status', 'stdout', 'stderr', 'summary')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_inbox_items_created_at ON inbox_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_items_gtd_bucket ON inbox_items(gtd_bucket);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_inbox_item_id ON processing_logs(inbox_item_id);
CREATE INDEX IF NOT EXISTS idx_dev_agent_jobs_status_created_at ON dev_agent_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_agent_jobs_source_chat_id_created_at ON dev_agent_jobs(source_chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_agent_job_events_job_id_sequence ON dev_agent_job_events(job_id, sequence ASC);
