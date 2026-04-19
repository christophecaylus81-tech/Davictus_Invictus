import type { ProjectRepository } from "../../domain/projects/repositories";
import type { Project } from "../../domain/projects/types";
import type { Queryable } from "../db/pool";
import { mapProjectRow } from "./sqlMappers";

function safeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 50;
  }
  return Math.min(Math.floor(limit), 200);
}

export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: Queryable) {}

  async list(limit: number): Promise<Project[]> {
    const result = await this.db.query(
      `SELECT * FROM projects ORDER BY updated_at DESC LIMIT $1`,
      [safeLimit(limit)]
    );
    return result.rows.map(mapProjectRow);
  }

  async listActive(): Promise<Project[]> {
    const result = await this.db.query(
      `SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC LIMIT 20`
    );
    return result.rows.map(mapProjectRow);
  }
}
