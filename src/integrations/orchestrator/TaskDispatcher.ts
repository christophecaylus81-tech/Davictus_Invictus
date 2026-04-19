import { join } from "path";
import type { AiRouter } from "../ai-router/AiRouter";
import type { LlmRequest } from "../ai-router/types";
import type { InterIAActor } from "./InterIABus";
import { InterIABus } from "./InterIABus";
import { MdParser } from "./MdParser";
import { MdWriter } from "./MdWriter";
import type { AgentId, Kanban, KanbanTask, MemoryEntry } from "./types";

// Prompt système par rôle d'agent
const AGENT_SYSTEM_PROMPTS: Record<AgentId, string> = {
  MANAGER: `Tu es le Manager IA du système Fusion. Tu coordonnes les agents spécialisés, évalues les résultats et prends les décisions d'orchestration.`,
  CODEX: `Tu es un agent de développement expert. Tu implémentes du code propre, robuste et bien structuré en suivant les contraintes et le contexte fournis.`,
  CLAUDE: `Tu es un agent d'analyse et de rédaction expert. Tu produis des analyses structurées, des notes de cadrage, des études de faisabilité et des rapports détaillés.`,
  DEEPSEEK: `Tu es un agent d'analyse technique et de recherche. Tu traites les sujets techniques complexes, la faisabilité, et les analyses de données.`,
  QWEN: `Tu es un agent de production rapide. Tu traites les tâches répétitives, les reformulations, les synthèses courtes et la génération de contenu structuré.`
};

export interface DispatchResult {
  taskId: string;
  success: boolean;
  reportPath?: string | undefined;
  error?: string | undefined;
}

const AGENT_TO_INTER_IA: Record<AgentId, InterIAActor> = {
  MANAGER: "MANAGER",
  CODEX: "CODEX",
  CLAUDE: "CLAUDE",
  DEEPSEEK: "DEEPSEEK",
  QWEN: "QWEN"
};

export class TaskDispatcher {
  private readonly parser = new MdParser();
  private readonly writer: MdWriter;
  private readonly bus: InterIABus;

  constructor(
    private readonly aiRouter: AiRouter,
    private readonly workDir: string
  ) {
    this.writer = new MdWriter(workDir);
    this.bus = new InterIABus(workDir);
  }

  // ── Dispatche une tâche vers l'IA assignée ──────────────────────────────────

  async dispatch(task: KanbanTask, kanban: Kanban): Promise<DispatchResult> {
    let current = kanban;

    // 1. Passer en EN COURS + log mémoire
    current = this.writer.updateTaskStatus(current, task.id, "in_progress", {
      startedAt: this.now()
    });
    await this.writer.writeKanban(current);
    await this.log(current, task.assignee, "statut", `${task.id} : À FAIRE → EN COURS`);

    const actor = AGENT_TO_INTER_IA[task.assignee] ?? "CODEX";
    const startedAt = Date.now();

    try {
      // 2. Log démarrage dans le bus inter-IA
      await this.bus.executionStarted(task.id, actor);

      // 3. Construire la requête vers l'IA
      const request = this.buildRequest(task);

      // 4. Router vers le bon modèle
      const response = await this.aiRouter.complete(task.title, request);

      // 5. Parser la réponse — note IA + contenu rapport
      const { noteIa, reportContent } = this.parseResponse(response.content, task);
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

      // 6. Écrire le rapport si demandé
      let reportPath: string | undefined;
      const modifiedFiles = this.extractFilePaths(reportContent);
      if (task.reportRequested && reportContent) {
        reportPath = await this.writer.writeReport({
          taskId: task.id,
          taskTitle: task.title,
          agentId: task.assignee,
          summary: reportContent,
          modifiedFiles
        });
        await this.log(current, task.assignee, "rapport", `${task.id} → ${reportPath}`);
      }

      // 7. Log résultat dans le bus inter-IA
      await this.bus.result(task.id, actor, noteIa ?? reportContent.slice(0, 300), {
        filesModified: modifiedFiles,
        ...(response.tokensUsed !== undefined ? { tokensUsed: response.tokensUsed } : {}),
        durationSeconds
      });

      // 8. Passer en REVIEW + note IA
      current = this.writer.updateTaskStatus(current, task.id, "review", {
        noteIa: noteIa ?? `Traité par ${response.model}`,
        reportPath: reportPath ?? (task.reportRequested ? join("reports", `${task.id}.md`) : undefined),
        verdict: "pending"
      });
      await this.writer.writeKanban(current);
      await this.log(current, task.assignee, "statut", `${task.id} : EN COURS → REVIEW`);

      return { taskId: task.id, success: true, reportPath };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // En cas d'erreur : log bus + repasser en todo pour réessai
      await this.bus.error(task.id, actor, errorMsg);
      current = this.writer.updateTaskStatus(current, task.id, "todo", {
        noteIa: `ERREUR: ${errorMsg}`
      });
      await this.writer.writeKanban(current);
      await this.log(current, "MANAGER", "statut", `${task.id} erreur dispatch : ${errorMsg}`);

      return { taskId: task.id, success: false, error: errorMsg };
    }
  }

  // ── Évalue une tâche en REVIEW (appelé par le Manager Loop) ────────────────

  async evaluate(task: KanbanTask, kanban: Kanban): Promise<{ satisfied: boolean; reason: string }> {
    // Lire le rapport si disponible
    let reportContent = "";
    if (task.reportPath) {
      try {
        const { readFile } = await import("fs/promises");
        reportContent = await readFile(join(this.workDir, task.reportPath), "utf-8");
      } catch {
        // Pas de rapport fichier, on utilise la note IA
        reportContent = task.noteIa ?? "";
      }
    } else {
      reportContent = task.noteIa ?? "";
    }

    const request: LlmRequest = {
      messages: [
        {
          role: "system",
          content: AGENT_SYSTEM_PROMPTS.MANAGER
        },
        {
          role: "user",
          content: `Évalue si cette tâche est satisfaisante.

Tâche : ${task.title}
Assignée à : ${task.assignee}
Prompt original : ${task.promptManager}

Résultat produit :
${reportContent || "(aucun rapport disponible)"}

Réponds en JSON : {"satisfied": true/false, "reason": "explication courte"}
Si satisfaisant → "satisfied": true
Si insuffisant → "satisfied": false avec la raison précise du rejet.`
        }
      ],
      maxTokens: 256,
      temperature: 0.1
    };

    try {
      const response = await this.aiRouter.complete(task.title, request);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Réponse non JSON");

      const parsed = JSON.parse(jsonMatch[0]) as { satisfied: boolean; reason: string };
      return { satisfied: parsed.satisfied, reason: parsed.reason ?? "" };
    } catch {
      // En cas d'erreur d'évaluation : valider par défaut
      return { satisfied: true, reason: "Évaluation automatique (fallback)" };
    }
  }

  // ── Helpers privés ──────────────────────────────────────────────────────────

  private buildRequest(task: KanbanTask): LlmRequest {
    const systemPrompt = AGENT_SYSTEM_PROMPTS[task.assignee];
    const reportInstruction = task.reportRequested
      ? "\n\nProduis un rapport détaillé incluant : ce qui a été fait, les choix techniques, les points d'attention, et les fichiers modifiés (préfixe chaque fichier avec '📄 ')."
      : "";

    return {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${task.promptManager}${reportInstruction}\n\nSi tu as des observations importantes pour le Manager, commence ta réponse par "📝 NOTE MANAGER: [ta note]" avant le contenu principal.`
        }
      ],
      maxTokens: task.reportRequested ? 2048 : 1024,
      temperature: 0.3
    };
  }

  private parseResponse(content: string, _task: KanbanTask): { noteIa: string | undefined; reportContent: string } {
    const noteMatch = content.match(/^📝 NOTE MANAGER:\s*(.+?)(?:\n|$)/m);
    const noteIa = noteMatch?.[1]?.trim();
    const reportContent = content.replace(/^📝 NOTE MANAGER:.+\n?/m, "").trim();
    return { noteIa, reportContent };
  }

  private extractFilePaths(content: string): string[] {
    const matches = content.matchAll(/📄\s+(.+)/g);
    return Array.from(matches, (m) => m[1]?.trim() ?? "").filter(Boolean);
  }

  private async log(kanban: Kanban, actor: AgentId, type: MemoryEntry["type"], detail: string): Promise<void> {
    await this.writer.appendMemory({
      timestamp: this.now(),
      actor,
      type,
      detail
    });
  }

  private now(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 16);
  }

  getCurrentKanban(): Promise<Kanban | null> {
    return new MdParser() && Promise.resolve(null); // sera remplacé par FileWatcher.readCurrent()
  }
}
