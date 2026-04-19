import type { TaskRepository, TaskListFilters, CreateTaskData } from "../../domain/tasks/repositories";
import type { Task, TaskStatus } from "../../domain/tasks/types";
import type { Queryable } from "../db/pool";
import { mapTaskRow } from "./sqlMappers";

function resolveLimit(value: number | undefined): number {
  if (!value || value <= 0) {
    return 50;
  }
  return Math.min(Math.floor(value), 200);
}

export class PgTaskRepository implements TaskRepository {
  constructor(private readonly db: Queryable) {}

  async list(filters: TaskListFilters = {}): Promise<Task[]> {
    const limit = resolveLimit(filters.limit);

    if (filters.projectId) {
      const result = await this.db.query(
        `
        SELECT *
        FROM tasks
        WHERE project_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        `,
        [filters.projectId, limit]
      );
      return result.rows.map(mapTaskRow);
    }

    const result = await this.db.query(
      `SELECT * FROM tasks ORDER BY updated_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapTaskRow);
  }

  async listActive(): Promise<Task[]> {
    const result = await this.db.query(
      `SELECT * FROM tasks WHERE status IN ('todo','next','in_progress') ORDER BY updated_at DESC LIMIT 20`
    );
    return result.rows.map(mapTaskRow);
  }

  async create(data: CreateTaskData): Promise<Task> {
    const result = await this.db.query(
      `INSERT INTO tasks (title, project_id, notes, status, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.title,
        data.projectId ?? null,
        data.notes ?? null,
        data.status ?? 'todo',
        data.priority ?? 2
      ]
    );
    return mapTaskRow(result.rows[0]);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const result = await this.db.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) throw new Error(`Tâche ${id} introuvable`);
    return mapTaskRow(result.rows[0]);
  }

  async updateProject(id: string, projectId: string | null): Promise<Task> {
    const result = await this.db.query(
      `UPDATE tasks SET project_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [projectId, id]
    );
    if (result.rows.length === 0) throw new Error(`Tâche ${id} introuvable`);
    return mapTaskRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  }
}
