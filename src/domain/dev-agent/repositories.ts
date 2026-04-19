import type {
  DevAgentEventKind,
  DevAgentJob,
  DevAgentJobEvent,
  DevAgentJobStatus,
  DevAgentJobType,
  DevAgentProvider
} from "./types";

export interface CreateDevAgentJobInput {
  sourceChatId: string;
  requestText: string;
  normalizedCommand: string;
  jobType: DevAgentJobType;
  provider: DevAgentProvider;
}

export interface UpdateDevAgentWorkspaceInput {
  repoPath?: string | null;
  branchName?: string | null;
  worktreePath?: string | null;
}

export interface DevAgentJobRepository {
  create(input: CreateDevAgentJobInput): Promise<DevAgentJob>;
  claimNext(workerId: string): Promise<DevAgentJob | null>;
  findById(id: string): Promise<DevAgentJob | null>;
  listRecentByChat(sourceChatId: string, limit: number): Promise<DevAgentJob[]>;
  listEvents(jobId: string, afterSequence?: number, limit?: number): Promise<DevAgentJobEvent[]>;
  appendEvent(jobId: string, kind: DevAgentEventKind, message: string): Promise<DevAgentJobEvent>;
  setWorkspace(id: string, input: UpdateDevAgentWorkspaceInput): Promise<DevAgentJob>;
  updateStatus(id: string, status: DevAgentJobStatus, summary?: string | null, errorMessage?: string | null): Promise<DevAgentJob>;
}
