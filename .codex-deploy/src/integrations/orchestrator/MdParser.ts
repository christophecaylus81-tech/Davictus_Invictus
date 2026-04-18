import type { AgentId, Kanban, KanbanTask, MemoryEntry, TaskStatus } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTableRows(block: string): Record<string, string>[] {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 2) return [];

  // Ligne 0 = headers, ligne 1 = séparateur (---|---), reste = données
  const firstLine = lines[0];
  if (!firstLine) return [];
  const headers = firstLine
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());

  return lines.slice(2).map((line) => {
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function parseAgentId(raw: string): AgentId {
  const upper = raw.toUpperCase().trim() as AgentId;
  const valid: AgentId[] = ["CODEX", "CLAUDE", "DEEPSEEK", "QWEN", "MANAGER"];
  return valid.includes(upper) ? upper : "MANAGER";
}

function extractProjectMeta(content: string): { projectName: string; managerModel: string; startedAt: string } {
  const titleMatch = content.match(/^#\s+KANBAN\s+[—–-]\s+(.+)$/m);
  const metaMatch = content.match(/_Manager:\s*(.+?)\s*\|\s*Démarré:\s*(.+?)_/);

  return {
    projectName: titleMatch?.[1]?.trim() ?? "Projet",
    managerModel: metaMatch?.[1]?.trim() ?? "Claude Sonnet",
    startedAt: metaMatch?.[2]?.trim() ?? ""
  };
}

// ─── Section parsers ───────────────────────────────────────────────────────────

function parseTodoSection(block: string): KanbanTask[] {
  return parseTableRows(block).map((row) => ({
    id: row["ID"] ?? "",
    title: row["Tâche"] ?? "",
    assignee: parseAgentId(row["Assignée"] ?? "MANAGER"),
    promptManager: row["Prompt Manager"] ?? "",
    reportRequested: (row["Rapport"] ?? "non").toLowerCase() === "oui",
    status: "todo" as TaskStatus
  }));
}

function parseInProgressSection(block: string): KanbanTask[] {
  return parseTableRows(block).map((row) => ({
    id: row["ID"] ?? "",
    title: row["Tâche"] ?? "",
    assignee: parseAgentId(row["Assignée"] ?? "MANAGER"),
    promptManager: "",
    reportRequested: (row["Rapport"] ?? "non").toLowerCase() === "oui",
    status: "in_progress" as TaskStatus,
    startedAt: row["Démarré"] ?? undefined,
    noteIa: row["Note IA"] !== "" ? row["Note IA"] : undefined
  }));
}

function parseReviewSection(block: string): KanbanTask[] {
  return parseTableRows(block).map((row) => ({
    id: row["ID"] ?? "",
    title: row["Tâche"] ?? "",
    assignee: parseAgentId(row["Assignée"] ?? "MANAGER"),
    promptManager: "",
    reportRequested: false,
    status: "review" as TaskStatus,
    reportPath: row["Résultat"] !== "" ? row["Résultat"] : undefined,
    verdict: "pending"
  }));
}

function parseDoneSection(block: string): KanbanTask[] {
  return parseTableRows(block).map((row) => ({
    id: row["ID"] ?? "",
    title: row["Tâche"] ?? "",
    assignee: parseAgentId(row["Assignée"] ?? "MANAGER"),
    promptManager: "",
    reportRequested: false,
    status: "done" as TaskStatus,
    validatedAt: row["Validé"] ?? undefined,
    verdict: "ok" as const
  }));
}

function parseRejectedSection(block: string): KanbanTask[] {
  return parseTableRows(block).map((row) => ({
    id: row["ID"] ?? "",
    title: row["Tâche"] ?? "",
    assignee: parseAgentId(row["Assignée"] ?? "MANAGER"),
    promptManager: "",
    reportRequested: false,
    status: "rejected" as TaskStatus,
    rejectedReason: row["Raison Manager"] ?? undefined,
    reassignedTo: row["Réassignée"] ? parseAgentId(row["Réassignée"]) : undefined,
    verdict: "rejected" as const
  }));
}

// ─── Section splitter ──────────────────────────────────────────────────────────

const SECTION_PATTERNS: Record<string, TaskStatus> = {
  "## 📋 À FAIRE": "todo",
  "## 🔄 EN COURS": "in_progress",
  "## 🔍 REVIEW MANAGER": "review",
  "## ✅ VALIDÉ": "done",
  "## ❌ REJETÉ → REFAIRE": "rejected"
};

function splitSections(content: string): Record<TaskStatus, string> {
  const result: Record<TaskStatus, string> = {
    todo: "",
    in_progress: "",
    review: "",
    done: "",
    rejected: ""
  };

  const lines = content.split("\n");
  let currentStatus: TaskStatus | null = null;
  let buffer: string[] = [];

  function flush() {
    if (currentStatus && buffer.length > 0) {
      result[currentStatus] = buffer.join("\n");
    }
    buffer = [];
  }

  for (const line of lines) {
    const matched = Object.entries(SECTION_PATTERNS).find(([pattern]) =>
      line.trimEnd().startsWith(pattern)
    );
    if (matched) {
      flush();
      currentStatus = matched[1];
    } else if (currentStatus) {
      buffer.push(line);
    }
  }
  flush();

  return result;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export class MdParser {
  parseKanban(content: string): Kanban {
    const meta = extractProjectMeta(content);
    const sections = splitSections(content);

    const tasks: KanbanTask[] = [
      ...parseTodoSection(sections.todo),
      ...parseInProgressSection(sections.in_progress),
      ...parseReviewSection(sections.review),
      ...parseDoneSection(sections.done),
      ...parseRejectedSection(sections.rejected)
    ].filter((t) => t.id !== "");

    return { ...meta, tasks };
  }

  parseMemory(content: string): MemoryEntry[] {
    return parseTableRows(content)
      .filter((row) => row["Timestamp"])
      .map((row) => ({
        timestamp: row["Timestamp"] ?? "",
        actor: parseAgentId(row["Acteur"] ?? "MANAGER"),
        type: (row["Type"] ?? "note") as MemoryEntry["type"],
        detail: row["Détail"] ?? ""
      }));
  }

  getTasksByStatus(kanban: Kanban, status: TaskStatus): KanbanTask[] {
    return kanban.tasks.filter((t) => t.status === status);
  }

  getTasksByAgent(kanban: Kanban, agent: AgentId): KanbanTask[] {
    return kanban.tasks.filter((t) => t.assignee === agent);
  }

  findTask(kanban: Kanban, id: string): KanbanTask | undefined {
    return kanban.tasks.find((t) => t.id === id);
  }
}
