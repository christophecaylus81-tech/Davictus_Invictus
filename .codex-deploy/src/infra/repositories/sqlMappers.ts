import type { ProcessingLogRecord } from "../../domain/logs/repositories";
import type { InboxItem, InboxSource, InboxStatus } from "../../domain/inbox/types";
import type { Project, ProjectStatus } from "../../domain/projects/types";
import type { Task, TaskStatus } from "../../domain/tasks/types";
import type { GtdBucket } from "../../domain/gtd/types";

interface InboxRow {
  id: string;
  source: string;
  user_id: string | null;
  external_ref: string | null;
  content: string;
  status: string;
  gtd_bucket: string | null;
  classification_reason: string | null;
  project_id: string | null;
  task_id: string | null;
  created_at: Date | string;
  processed_at: Date | string | null;
  deleted_at: Date | string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TaskRow {
  id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProcessingLogRow {
  id: number;
  inbox_item_id: string;
  stage: string;
  message: string;
  created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function mapInboxRow(row: InboxRow): InboxItem {
  return {
    id: row.id,
    source: row.source as InboxSource,
    userId: row.user_id,
    externalRef: row.external_ref,
    content: row.content,
    status: row.status as InboxStatus,
    gtdBucket: row.gtd_bucket as GtdBucket | null,
    classificationReason: row.classification_reason,
    projectId: row.project_id,
    taskId: row.task_id,
    createdAt: toDate(row.created_at),
    processedAt: row.processed_at ? toDate(row.processed_at) : null,
    deletedAt: row.deleted_at ? toDate(row.deleted_at) : null
  };
}

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as ProjectStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    notes: row.notes,
    status: row.status as TaskStatus,
    priority: Number(row.priority),
    dueDate: row.due_date,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export function mapProcessingLogRow(row: ProcessingLogRow): ProcessingLogRecord {
  return {
    id: row.id,
    inboxItemId: row.inbox_item_id,
    stage: row.stage,
    message: row.message,
    createdAt: toDate(row.created_at)
  };
}
