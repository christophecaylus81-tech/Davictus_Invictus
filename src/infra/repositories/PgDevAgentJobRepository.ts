import type {
  CreateDevAgentJobInput,
  DevAgentJobRepository,
  UpdateDevAgentWorkspaceInput
} from "../../domain/dev-agent/repositories";
import type { DevAgentEventKind, DevAgentJob, DevAgentJobEvent, DevAgentJobStatus } from "../../domain/dev-agent/types";
import type { Queryable } from "../db/pool";
import { mapDevAgentJobEventRow, mapDevAgentJobRow } from "./sqlMappers";

function resolveLimit(value: number | undefined, fallback = 20): number {
  if (!value || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), 200);
}

export class PgDevAgentJobRepository implements DevAgentJobRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateDevAgentJobInput): Promise<DevAgentJob> {
    const result = await this.db.query(
      `
      INSERT INTO dev_agent_jobs (
        source_chat_id, request_text, normalized_command, job_type, provider
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        input.sourceChatId,
        input.requestText,
        input.normalizedCommand,
        input.jobType,
        input.provider
      ]
    );

    return mapDevAgentJobRow(result.rows[0]);
  }

  async claimNext(workerId: string): Promise<DevAgentJob | null> {
    const result = await this.db.query(
      `
      WITH next_job AS (
        SELECT id
        FROM dev_agent_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE dev_agent_jobs AS jobs
      SET
        status = 'running',
        claimed_by = $1,
        claimed_at = NOW(),
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
      FROM next_job
      WHERE jobs.id = next_job.id
      RETURNING jobs.*
      `,
      [workerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapDevAgentJobRow(result.rows[0]);
  }

  async findById(id: string): Promise<DevAgentJob | null> {
    const result = await this.db.query(
      `SELECT * FROM dev_agent_jobs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapDevAgentJobRow(result.rows[0]);
  }

  async listRecentByChat(sourceChatId: string, limit: number): Promise<DevAgentJob[]> {
    const result = await this.db.query(
      `
      SELECT *
      FROM dev_agent_jobs
      WHERE source_chat_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [sourceChatId, resolveLimit(limit)]
    );

    return result.rows.map(mapDevAgentJobRow);
  }

  async listEvents(jobId: string, afterSequence = 0, limit = 50): Promise<DevAgentJobEvent[]> {
    const result = await this.db.query(
      `
      SELECT *
      FROM dev_agent_job_events
      WHERE job_id = $1 AND sequence > $2
      ORDER BY sequence ASC
      LIMIT $3
      `,
      [jobId, afterSequence, resolveLimit(limit, 50)]
    );

    return result.rows.map(mapDevAgentJobEventRow);
  }

  async appendEvent(jobId: string, kind: DevAgentEventKind, message: string): Promise<DevAgentJobEvent> {
    const result = await this.db.query(
      `
      WITH next_sequence AS (
        SELECT COALESCE(MAX(sequence), 0) + 1 AS value
        FROM dev_agent_job_events
        WHERE job_id = $1
      )
      INSERT INTO dev_agent_job_events (job_id, sequence, kind, message)
      SELECT $1, value, $2, $3
      FROM next_sequence
      RETURNING *
      `,
      [jobId, kind, message]
    );

    return mapDevAgentJobEventRow(result.rows[0]);
  }

  async setWorkspace(id: string, input: UpdateDevAgentWorkspaceInput): Promise<DevAgentJob> {
    const result = await this.db.query(
      `
      UPDATE dev_agent_jobs
      SET
        repo_path = COALESCE($2, repo_path),
        branch_name = COALESCE($3, branch_name),
        worktree_path = COALESCE($4, worktree_path),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.repoPath ?? null,
        input.branchName ?? null,
        input.worktreePath ?? null
      ]
    );

    if (result.rows.length === 0) {
      throw new Error(`Job dev ${id} introuvable`);
    }

    return mapDevAgentJobRow(result.rows[0]);
  }

  async updateStatus(id: string, status: DevAgentJobStatus, summary?: string | null, errorMessage?: string | null): Promise<DevAgentJob> {
    const result = await this.db.query(
      `
      UPDATE dev_agent_jobs
      SET
        status = $2,
        summary = COALESCE($3, summary),
        error_message = COALESCE($4, error_message),
        completed_at = CASE
          WHEN $2 IN ('completed', 'failed', 'blocked', 'cancelled') THEN NOW()
          ELSE completed_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, status, summary ?? null, errorMessage ?? null]
    );

    if (result.rows.length === 0) {
      throw new Error(`Job dev ${id} introuvable`);
    }

    return mapDevAgentJobRow(result.rows[0]);
  }
}
