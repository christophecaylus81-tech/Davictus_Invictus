import type { InboxRepository, CreateInboxItemInput } from "../../domain/inbox/repositories";
import type { InboxItem } from "../../domain/inbox/types";
import type { Queryable } from "../db/pool";
import { mapInboxRow } from "./sqlMappers";

const DEFAULT_LIMIT = 50;

function safeLimit(limit: number, fallback = DEFAULT_LIMIT): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(limit), 200);
}

export class PgInboxRepository implements InboxRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateInboxItemInput): Promise<InboxItem> {
    const result = await this.db.query(
      `
      INSERT INTO inbox_items (source, user_id, external_ref, content, status)
      VALUES ($1, $2, $3, $4, 'captured')
      RETURNING *
      `,
      [input.source, input.userId ?? null, input.externalRef ?? null, input.content]
    );
    return mapInboxRow(result.rows[0]);
  }

  async findById(id: string): Promise<InboxItem | null> {
    const result = await this.db.query(`SELECT * FROM inbox_items WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapInboxRow(result.rows[0]);
  }

  async listRecent(limit: number): Promise<InboxItem[]> {
    const result = await this.db.query(
      `
      SELECT *
      FROM inbox_items
      WHERE status <> 'deleted'
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [safeLimit(limit)]
    );

    return result.rows.map(mapInboxRow);
  }
}
