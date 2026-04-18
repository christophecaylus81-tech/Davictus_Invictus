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

CREATE INDEX IF NOT EXISTS idx_inbox_items_created_at ON inbox_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_items_gtd_bucket ON inbox_items(gtd_bucket);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_inbox_item_id ON processing_logs(inbox_item_id);
