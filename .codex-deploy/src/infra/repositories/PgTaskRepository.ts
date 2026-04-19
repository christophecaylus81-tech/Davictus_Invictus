import type { TaskRepository, TaskListFilters } from "../../domain/tasks/repositories";
import type { Task } from "../../domain/tasks/types";
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
}
