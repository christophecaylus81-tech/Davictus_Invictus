import type {
  CreateProcessingLogInput,
  ProcessingLogRecord,
  ProcessingLogRepository
} from "../../domain/logs/repositories";
import type { Queryable } from "../db/pool";
import { mapProcessingLogRow } from "./sqlMappers";

function safeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 100;
  }
  return Math.min(Math.floor(limit), 500);
}

export class PgProcessingLogRepository implements ProcessingLogRepository {
  constructor(private readonly db: Queryable) {}

  async append(input: CreateProcessingLogInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO processing_logs (inbox_item_id, stage, message)
      VALUES ($1, $2, $3)
      `,
      [input.inboxItemId, input.stage, input.message]
    );
  }

  async listByInboxItem(inboxItemId: string, limit: number): Promise<ProcessingLogRecord[]> {
    const result = await this.db.query(
      `
      SELECT *
      FROM processing_logs
      WHERE inbox_item_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [inboxItemId, safeLimit(limit)]
    );

    return result.rows.map(mapProcessingLogRow);
  }
}
