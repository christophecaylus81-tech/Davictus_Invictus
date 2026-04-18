export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "rejected";
export type AgentId = "CODEX" | "CLAUDE" | "DEEPSEEK" | "QWEN" | "MANAGER";
export type ReportRequested = boolean;

export interface KanbanTask {
  id: string;                      // T-001
  title: string;
  assignee: AgentId;
  promptManager: string;           // Prompt écrit par le Manager pour l'IA assignée
  status: TaskStatus;
  reportRequested: ReportRequested;
  // Champs enrichis selon le statut
  startedAt?: string | undefined;
  noteIa?: string | undefined;     // Note laissée par l'IA assignée au Manager
  reportPath?: string | undefined; // Chemin vers reports/T-001.md
  verdict?: "pending" | "ok" | "rejected" | undefined;
  rejectedReason?: string | undefined;
  reassignedTo?: AgentId | undefined;
  validatedAt?: string | undefined;
}

export interface Kanban {
  projectName: string;
  managerModel: string;
  startedAt: string;
  tasks: KanbanTask[];
}

export interface MemoryEntry {
  timestamp: string;
  actor: AgentId;
  type: "assignation" | "statut" | "note" | "verdict" | "rejet" | "rapport";
  detail: string;
}

export interface TaskReport {
  taskId: string;
  taskTitle: string;
  agentId: AgentId;
  durationMinutes?: number | undefined;
  summary: string;
  technicalChoices?: string | undefined;
  warnings?: string | undefined;
  modifiedFiles?: string[] | undefined;
}
