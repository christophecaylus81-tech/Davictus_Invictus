export type DevAgentJobType = "run_tests" | "code_task";
export type DevAgentProvider = "codex" | "claude" | "shell";
export type DevAgentJobStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "cancelled";
export type DevAgentEventKind = "status" | "stdout" | "stderr" | "summary";

export interface DevAgentJob {
  id: string;
  sourceChatId: string;
  requestText: string;
  normalizedCommand: string;
  jobType: DevAgentJobType;
  provider: DevAgentProvider;
  status: DevAgentJobStatus;
  repoPath: string | null;
  branchName: string | null;
  worktreePath: string | null;
  summary: string | null;
  errorMessage: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevAgentJobEvent {
  id: number;
  jobId: string;
  sequence: number;
  kind: DevAgentEventKind;
  message: string;
  createdAt: Date;
}
