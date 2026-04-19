/**
 * InterIABus — canal de communication partagé entre agents IA
 *
 * Toute interaction entre le Manager et les exécuteurs est loguée ici en JSONL.
 * Format : workspace/INTER_IA.jsonl
 *
 * Flux :
 *   Manager → task_dispatched  → Exécuteur lit et travaille
 *   Exécuteur → result         → Manager lit + produit verdict
 *   Manager → verdict          → Task validée ou rejetée + KPIs → User notifié
 */

import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InterIAActor =
  | "MANAGER"
  | "CODEX"
  | "CLAUDE"
  | "DEEPSEEK"
  | "QWEN"
  | "GEMINI"
  | "SYSTEM";

export type InterIAMessageType =
  | "task_dispatched"   // Manager → exécuteur : nouvelle tâche assignée
  | "execution_started" // Exécuteur → tous : démarrage
  | "result"            // Exécuteur → Manager : travail terminé
  | "kpi_report"        // Exécuteur → Manager : métriques (lignes, tests, etc.)
  | "verdict"           // Manager → tous : validation ou rejet
  | "escalation"        // Davitus → Manager : demande escaladée
  | "notification"      // Manager → User : message à envoyer via Telegram
  | "error";            // Tout acteur : erreur signalée

export interface InterIAKPIs {
  linesAdded?: number;
  linesRemoved?: number;
  filesModified?: string[];
  testsPassed?: number;
  testsFailed?: number;
  durationSeconds?: number;
  tokensUsed?: number;
  [key: string]: unknown;
}

export interface InterIAMessage {
  id: string;               // uuid court (8 chars)
  timestamp: string;        // ISO 8601
  from: InterIAActor;
  to: InterIAActor | "ALL";
  type: InterIAMessageType;
  taskId?: string;          // ID Kanban (T-001, T-002…)
  jobId?: string;           // ID job DB dev_agent_jobs
  content: string;          // Description / résultat / verdict
  kpis?: InterIAKPIs;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── InterIABus ────────────────────────────────────────────────────────────────

export class InterIABus {
  private readonly busPath: string;

  constructor(private readonly workDir: string) {
    this.busPath = join(workDir, "INTER_IA.jsonl");
  }

  // ── Écriture ────────────────────────────────────────────────────────────────

  async write(msg: Omit<InterIAMessage, "id" | "timestamp">): Promise<InterIAMessage> {
    const full: InterIAMessage = {
      id: shortId(),
      timestamp: nowIso(),
      ...msg
    };
    await mkdir(this.workDir, { recursive: true });
    await appendFile(this.busPath, JSON.stringify(full) + "\n", "utf-8");
    return full;
  }

  // Raccourcis sémantiques
  async taskDispatched(taskId: string, assignee: InterIAActor, prompt: string): Promise<void> {
    await this.write({
      from: "MANAGER",
      to: assignee,
      type: "task_dispatched",
      taskId,
      content: prompt
    });
  }

  async executionStarted(taskId: string, actor: InterIAActor): Promise<void> {
    await this.write({
      from: actor,
      to: "ALL",
      type: "execution_started",
      taskId,
      content: `${actor} commence l'exécution de ${taskId}`
    });
  }

  async result(taskId: string, actor: InterIAActor, summary: string, kpis?: InterIAKPIs): Promise<void> {
    await this.write({
      from: actor,
      to: "MANAGER",
      type: "result",
      taskId,
      content: summary,
      ...(kpis ? { kpis } : {})
    });
  }

  async verdict(taskId: string, satisfied: boolean, reason: string): Promise<void> {
    await this.write({
      from: "MANAGER",
      to: "ALL",
      type: "verdict",
      taskId,
      content: satisfied
        ? `✅ ${taskId} validé — ${reason}`
        : `❌ ${taskId} rejeté — ${reason}`
    });
  }

  async escalation(jobId: string, from: InterIAActor, request: string): Promise<void> {
    await this.write({
      from,
      to: "MANAGER",
      type: "escalation",
      jobId,
      content: request
    });
  }

  async jobResult(jobId: string, actor: InterIAActor, status: "completed" | "failed" | "blocked", summary: string, kpis?: InterIAKPIs): Promise<void> {
    await this.write({
      from: actor,
      to: "MANAGER",
      type: "result",
      jobId,
      content: `[${status.toUpperCase()}] ${summary}`,
      ...(kpis ? { kpis } : {})
    });
  }

  async error(taskId: string | undefined, actor: InterIAActor, message: string): Promise<void> {
    await this.write({
      from: actor,
      to: "MANAGER",
      type: "error",
      ...(taskId ? { taskId } : {}),
      content: message
    });
  }

  // ── Lecture ─────────────────────────────────────────────────────────────────

  async readAll(): Promise<InterIAMessage[]> {
    try {
      const raw = await readFile(this.busPath, "utf-8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as InterIAMessage);
    } catch {
      return [];
    }
  }

  async readRecent(n = 20): Promise<InterIAMessage[]> {
    const all = await this.readAll();
    return all.slice(-n);
  }

  async readByTask(taskId: string): Promise<InterIAMessage[]> {
    const all = await this.readAll();
    return all.filter((m) => m.taskId === taskId);
  }

  async readByJob(jobId: string): Promise<InterIAMessage[]> {
    const all = await this.readAll();
    return all.filter((m) => m.jobId === jobId);
  }

  // ── Rapport texte pour Telegram ─────────────────────────────────────────────

  async formatRecent(n = 10): Promise<string> {
    const msgs = await this.readRecent(n);
    if (msgs.length === 0) return "_Aucune activité inter-IA récente._";

    const lines = msgs.map((m) => {
      const ts = m.timestamp.slice(11, 16); // HH:MM
      const kpiStr = m.kpis
        ? ` [${Object.entries(m.kpis)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(", ")}]`
        : "";
      return `\`${ts}\` *${m.from}→${m.to}* [${m.type}]${m.taskId ? ` T:${m.taskId}` : ""}${kpiStr}\n${m.content.slice(0, 120)}`;
    });

    return `*Conversation Inter-IA (${msgs.length} derniers messages) :*\n\n${lines.join("\n\n")}`;
  }

  // ── Snapshot pour réinitialisation périodique ────────────────────────────────

  async rotate(maxLines = 1000): Promise<void> {
    const all = await this.readAll();
    if (all.length <= maxLines) return;
    const kept = all.slice(-maxLines);
    await writeFile(this.busPath, kept.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf-8");
  }
}
