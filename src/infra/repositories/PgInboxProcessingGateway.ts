import type {
  InboxProcessingGateway,
  InboxProcessingResult
} from "../../domain/inbox/repositories";
import type { GtdClassification } from "../../domain/gtd/types";
import type { InboxItem } from "../../domain/inbox/types";
import { withTransaction } from "../db/pool";
import { mapInboxRow } from "./sqlMappers";

function firstRowOrThrow<T>(rows: T[], errorMessage: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(errorMessage);
  }
  return row;
}

async function processAsTask(item: InboxItem, classification: GtdClassification): Promise<InboxProcessingResult> {
  return withTransaction(async (client) => {
    const taskResult = await client.query<{ id: string }>(
      `
      INSERT INTO tasks (title, notes, status, priority)
      VALUES ($1, $2, 'todo', 2)
      RETURNING id
      `,
      [classification.suggestedTitle, `Créée depuis inbox ${item.id}`]
    );

    const taskRow = firstRowOrThrow(taskResult.rows, "Création de tâche impossible.");
    const taskId = taskRow.id;
    const inboxResult = await client.query(
      `
      UPDATE inbox_items
      SET status = 'processed',
          gtd_bucket = 'task',
          classification_reason = $2,
          task_id = $3,
          project_id = NULL,
          processed_at = NOW(),
          deleted_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [item.id, classification.reason, taskId]
    );

    return {
      inboxItem: mapInboxRow(inboxResult.rows[0]),
      bucket: "task",
      projectId: null,
      taskId
    };
  });
}

async function processAsProject(
  item: InboxItem,
  classification: GtdClassification
): Promise<InboxProcessingResult> {
  return withTransaction(async (client) => {
    const projectResult = await client.query<{ id: string }>(
      `
      INSERT INTO projects (title, description, status)
      VALUES ($1, $2, 'active')
      RETURNING id
      `,
      [classification.suggestedTitle, `Créé depuis inbox ${item.id}`]
    );

    const projectRow = firstRowOrThrow(projectResult.rows, "Création de projet impossible.");
    const projectId = projectRow.id;
    const taskResult = await client.query<{ id: string }>(
      `
      INSERT INTO tasks (project_id, title, notes, status, priority)
      VALUES ($1, $2, $3, 'next', 2)
      RETURNING id
      `,
      [
        projectId,
        classification.suggestedTaskTitle ?? "Définir la prochaine action",
        "Tâche de démarrage automatique du projet"
      ]
    );
    const taskRow = firstRowOrThrow(taskResult.rows, "Création de tâche projet impossible.");
    const taskId = taskRow.id;

    const inboxResult = await client.query(
      `
      UPDATE inbox_items
      SET status = 'processed',
          gtd_bucket = 'project',
          classification_reason = $2,
          project_id = $3,
          task_id = $4,
          processed_at = NOW(),
          deleted_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [item.id, classification.reason, projectId, taskId]
    );

    return {
      inboxItem: mapInboxRow(inboxResult.rows[0]),
      bucket: "project",
      projectId,
      taskId
    };
  });
}

async function processAsArchiveLike(
  item: InboxItem,
  classification: GtdClassification
): Promise<InboxProcessingResult> {
  return withTransaction(async (client) => {
    const inboxResult = await client.query(
      `
      UPDATE inbox_items
      SET status = 'archived',
          gtd_bucket = $2,
          classification_reason = $3,
          project_id = NULL,
          task_id = NULL,
          processed_at = NOW(),
          deleted_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [item.id, classification.bucket, classification.reason]
    );

    return {
      inboxItem: mapInboxRow(inboxResult.rows[0]),
      bucket: classification.bucket,
      projectId: null,
      taskId: null
    };
  });
}

async function processAsTrash(
  item: InboxItem,
  classification: GtdClassification
): Promise<InboxProcessingResult> {
  return withTransaction(async (client) => {
    const inboxResult = await client.query(
      `
      UPDATE inbox_items
      SET status = 'deleted',
          gtd_bucket = 'trash',
          classification_reason = $2,
          project_id = NULL,
          task_id = NULL,
          processed_at = NOW(),
          deleted_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [item.id, classification.reason]
    );

    return {
      inboxItem: mapInboxRow(inboxResult.rows[0]),
      bucket: "trash",
      projectId: null,
      taskId: null
    };
  });
}

export class PgInboxProcessingGateway implements InboxProcessingGateway {
  async processClassification(input: {
    item: InboxItem;
    classification: GtdClassification;
  }): Promise<InboxProcessingResult> {
    const { item, classification } = input;

    switch (classification.bucket) {
      case "task":
        return processAsTask(item, classification);
      case "project":
        return processAsProject(item, classification);
      case "incubator":
      case "archive":
        return processAsArchiveLike(item, classification);
      case "trash":
        return processAsTrash(item, classification);
      default:
        throw new Error(`Bucket GTD non géré: ${classification.bucket satisfies never}`);
    }
  }
}
