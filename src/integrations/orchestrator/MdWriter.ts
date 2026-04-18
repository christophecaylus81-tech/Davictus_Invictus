import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { AgentId, Kanban, KanbanTask, MemoryEntry, TaskReport } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

function row(...cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ─── KANBAN renderer ──────────────────────────────────────────────────────────

function renderTodoTable(tasks: KanbanTask[]): string {
  if (tasks.length === 0) return "_Aucune tâche._\n";
  const header = row("ID", "Tâche", "Assignée", "Prompt Manager", "Rapport");
  const sep = row("---", "---", "---", "---", "---");
  const rows = tasks.map((t) =>
    row(
      t.id,
      escapeCell(t.title),
      t.assignee,
      escapeCell(t.promptManager),
      t.reportRequested ? "oui" : "non"
    )
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderInProgressTable(tasks: KanbanTask[]): string {
  if (tasks.length === 0) return "_Aucune tâche._\n";
  const header = row("ID", "Tâche", "Assignée", "Démarré", "Note IA", "Rapport");
  const sep = row("---", "---", "---", "---", "---", "---");
  const rows = tasks.map((t) =>
    row(
      t.id,
      escapeCell(t.title),
      t.assignee,
      t.startedAt ?? "",
      escapeCell(t.noteIa ?? ""),
      t.reportRequested ? "oui" : "non"
    )
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderReviewTable(tasks: KanbanTask[]): string {
  if (tasks.length === 0) return "_Aucune tâche._\n";
  const header = row("ID", "Tâche", "Assignée", "Résultat", "Verdict Manager");
  const sep = row("---", "---", "---", "---", "---");
  const rows = tasks.map((t) =>
    row(
      t.id,
      escapeCell(t.title),
      t.assignee,
      t.reportPath ?? "",
      t.verdict === "pending" ? "⏳ en cours" : t.verdict === "ok" ? "✅" : "❌"
    )
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderDoneTable(tasks: KanbanTask[]): string {
  if (tasks.length === 0) return "_Aucune tâche._\n";
  const header = row("ID", "Tâche", "Assignée", "Validé");
  const sep = row("---", "---", "---", "---");
  const rows = tasks.map((t) =>
    row(t.id, escapeCell(t.title), t.assignee, t.validatedAt ?? "")
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderRejectedTable(tasks: KanbanTask[]): string {
  if (tasks.length === 0) return "_Aucune tâche._\n";
  const header = row("ID", "Tâche", "Raison Manager", "Réassignée");
  const sep = row("---", "---", "---", "---");
  const rows = tasks.map((t) =>
    row(
      t.id,
      escapeCell(t.title),
      escapeCell(t.rejectedReason ?? ""),
      t.reassignedTo ?? ""
    )
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderKanban(kanban: Kanban): string {
  const todo = kanban.tasks.filter((t) => t.status === "todo");
  const inProgress = kanban.tasks.filter((t) => t.status === "in_progress");
  const review = kanban.tasks.filter((t) => t.status === "review");
  const done = kanban.tasks.filter((t) => t.status === "done");
  const rejected = kanban.tasks.filter((t) => t.status === "rejected");

  return [
    `# KANBAN — ${kanban.projectName}`,
    `_Manager: ${kanban.managerModel} | Démarré: ${kanban.startedAt}_`,
    "",
    "## 📋 À FAIRE",
    renderTodoTable(todo),
    "## 🔄 EN COURS",
    renderInProgressTable(inProgress),
    "## 🔍 REVIEW MANAGER",
    renderReviewTable(review),
    "## ✅ VALIDÉ",
    renderDoneTable(done),
    "## ❌ REJETÉ → REFAIRE",
    renderRejectedTable(rejected)
  ].join("\n");
}

// ─── Report renderer ──────────────────────────────────────────────────────────

function renderReport(report: TaskReport): string {
  const lines = [
    `# Rapport — ${report.taskId} : ${report.taskTitle}`,
    `_IA : ${report.agentId}${report.durationMinutes !== undefined ? ` | Durée : ${report.durationMinutes} min` : ""}_`,
    "",
    "## Résumé",
    report.summary
  ];

  if (report.technicalChoices) {
    lines.push("", "## Choix techniques", report.technicalChoices);
  }
  if (report.warnings) {
    lines.push("", "## Points d'attention", report.warnings);
  }
  if (report.modifiedFiles && report.modifiedFiles.length > 0) {
    lines.push("", "## Fichiers modifiés");
    report.modifiedFiles.forEach((f) => lines.push(`- ${f}`));
  }

  return lines.join("\n") + "\n";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export class MdWriter {
  constructor(private readonly baseDir: string) {}

  private kanbanPath(): string {
    return join(this.baseDir, "KANBAN.md");
  }

  private memoryPath(): string {
    return join(this.baseDir, "MEMORY.md");
  }

  private reportPath(taskId: string): string {
    return join(this.baseDir, "reports", `${taskId}.md`);
  }

  async writeKanban(kanban: Kanban): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(this.kanbanPath(), renderKanban(kanban), "utf-8");
  }

  async appendMemory(entry: MemoryEntry): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const memPath = this.memoryPath();

    // Initialise le fichier si absent
    let exists = true;
    try {
      await readFile(memPath);
    } catch {
      exists = false;
    }

    if (!exists) {
      await writeFile(
        memPath,
        "# MÉMOIRE DU PROJET\n\n| Timestamp | Acteur | Type | Détail |\n|---|---|---|---|\n",
        "utf-8"
      );
    }

    await appendFile(
      memPath,
      `${row(entry.timestamp, entry.actor, entry.type, escapeCell(entry.detail))}\n`,
      "utf-8"
    );
  }

  async writeReport(report: TaskReport): Promise<string> {
    const path = this.reportPath(report.taskId);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, renderReport(report), "utf-8");
    return path;
  }

  // ── Mutations sur le Kanban ────────────────────────────────────────────────

  updateTaskStatus(
    kanban: Kanban,
    taskId: string,
    status: KanbanTask["status"],
    patch?: Partial<KanbanTask>
  ): Kanban {
    return {
      ...kanban,
      tasks: kanban.tasks.map((t) =>
        t.id === taskId ? { ...t, status, ...patch } : t
      )
    };
  }

  addTask(kanban: Kanban, task: KanbanTask): Kanban {
    return { ...kanban, tasks: [...kanban.tasks, task] };
  }

  setTaskNote(kanban: Kanban, taskId: string, note: string): Kanban {
    return this.updateTaskStatus(kanban, taskId, "in_progress", { noteIa: note });
  }

  validateTask(kanban: Kanban, taskId: string): Kanban {
    return this.updateTaskStatus(kanban, taskId, "done", {
      verdict: "ok",
      validatedAt: `✅ ${now()}`
    });
  }

  rejectTask(
    kanban: Kanban,
    taskId: string,
    reason: string,
    reassignTo?: AgentId
  ): Kanban {
    return this.updateTaskStatus(kanban, taskId, "rejected", {
      verdict: "rejected",
      rejectedReason: reason,
      reassignedTo: reassignTo
    });
  }

  // Génère le prochain ID de tâche (T-001, T-002…)
  nextTaskId(kanban: Kanban): string {
    const max = kanban.tasks.reduce((acc, t) => {
      const n = parseInt(t.id.replace("T-", ""), 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return `T-${String(max + 1).padStart(3, "0")}`;
  }
}
