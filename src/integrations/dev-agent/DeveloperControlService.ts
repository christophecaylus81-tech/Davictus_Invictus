import { readFile } from "node:fs/promises";
import type { DevAgentJobRepository } from "../../domain/dev-agent/repositories";
import type { DevAgentJob, DevAgentJobEvent, DevAgentProvider } from "../../domain/dev-agent/types";
import { parseKanban } from "../../api/parseKanban";

export interface DeveloperProjectContext {
  id: string;
  title: string;
}

export interface DeveloperHandleInput {
  chatId: string;
  text: string;
  currentProject?: DeveloperProjectContext | null;
}

export interface DeveloperHandleResult {
  reply: string;
  jobId?: string;
}

type DeveloperIntent =
  | { kind: "kanban_status" }
  | { kind: "run_tests" }
  | { kind: "code_task"; provider: DevAgentProvider; request: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export class DeveloperControlService {
  constructor(
    private readonly jobRepository: DevAgentJobRepository,
    private readonly kanbanPath: string
  ) {}

  async handleMessage(input: DeveloperHandleInput): Promise<DeveloperHandleResult | null> {
    const intent = this.parseIntent(input.text);
    if (!intent) {
      return null;
    }

    if (intent.kind === "kanban_status") {
      return {
        reply: await this.renderKanbanStatus()
      };
    }

    const enrichedRequest = input.currentProject
      ? `${input.text}\n\nContexte projet courant: [${input.currentProject.id}] ${input.currentProject.title}`
      : input.text;

    const job = await this.jobRepository.create({
      sourceChatId: input.chatId,
      requestText: enrichedRequest,
      normalizedCommand: intent.kind === "run_tests" ? "npm test" : intent.request,
      jobType: intent.kind,
      provider: intent.kind === "run_tests" ? "shell" : intent.provider
    });

    await this.jobRepository.appendEvent(job.id, "status", "Job cree et en attente d'un worker.");

    return {
      reply: this.renderJobCreated(job),
      jobId: job.id
    };
  }

  async listRecentJobs(chatId: string): Promise<string> {
    const jobs = await this.jobRepository.listRecentByChat(chatId, 5);
    if (jobs.length === 0) {
      return "Aucun job dev recent.";
    }

    return [
      "Jobs dev recents :",
      ...jobs.map((job) => `- ${job.id.slice(0, 8)} | ${job.status} | ${job.jobType} | ${job.requestText.split("\n")[0]}`)
    ].join("\n");
  }

  async getJobUpdates(jobId: string, afterSequence: number): Promise<{ job: DevAgentJob | null; events: DevAgentJobEvent[] }> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return { job: null, events: [] };
    }

    const events = await this.jobRepository.listEvents(jobId, afterSequence, 20);
    return { job, events };
  }

  formatJobUpdate(job: DevAgentJob, events: DevAgentJobEvent[]): string | null {
    if (events.length === 0 && job.status === "running") {
      return null;
    }

    const lines: string[] = [];

    for (const event of events) {
      const prefix = event.kind === "stderr" ? "ERR" : event.kind === "stdout" ? "OUT" : "INFO";
      lines.push(`${prefix} ${event.message}`);
    }

    if (job.status === "completed") {
      lines.push(`Termine. ${job.summary ?? "Sans resume."}`);
    } else if (job.status === "failed" || job.status === "blocked") {
      lines.push(`Echec. ${job.errorMessage ?? "Sans detail."}`);
    }

    if (lines.length === 0) {
      return null;
    }

    return lines.slice(0, 6).join("\n").slice(0, 3500);
  }

  private parseIntent(text: string): DeveloperIntent | null {
    const trimmed = text.trim();
    const normalized = normalize(trimmed);

    if (trimmed.startsWith("/dev")) {
      const rest = trimmed.replace(/^\/dev(@\w+)?/i, "").trim();
      if (!rest) return null;

      if (normalize(rest).includes("kanban")) {
        return { kind: "kanban_status" };
      }
      if (/(^| )(tests?|npm test|vitest)( |$)/i.test(rest)) {
        return { kind: "run_tests" };
      }
      if (rest.toLowerCase().startsWith("claude:")) {
        return { kind: "code_task", provider: "claude", request: rest.slice(7).trim() };
      }
      if (rest.toLowerCase().startsWith("codex:")) {
        return { kind: "code_task", provider: "codex", request: rest.slice(6).trim() };
      }
      return { kind: "code_task", provider: "codex", request: rest };
    }

    if (normalized.includes("kanban") && (normalized.includes("etat") || normalized.includes("status") || normalized.includes("ou en est"))) {
      return { kind: "kanban_status" };
    }

    if (/(lance|execute|run|demarre).*(tests?|npm test|vitest)/i.test(normalized)) {
      return { kind: "run_tests" };
    }

    if (/^(ajoute|cree|create|refactorise|refactorize|modifie|implemente|implement|supprime)\b/i.test(normalized)) {
      return { kind: "code_task", provider: "codex", request: trimmed };
    }

    return null;
  }

  private async renderKanbanStatus(): Promise<string> {
    const markdown = await readFile(this.kanbanPath, "utf8");
    const board = parseKanban(markdown);
    const lines = [
      `Kanban: ${board.todo.length} a faire, ${board.inProgress.length} en cours, ${board.review.length} en review, ${board.validated.length} valides.`
    ];

    const focus = [...board.inProgress, ...board.review, ...board.todo].slice(0, 5);
    if (focus.length > 0) {
      lines.push("Focus :");
      lines.push(...focus.map((card) => `- ${card.id ? `[${card.id}] ` : ""}${card.title}`));
    }

    return lines.join("\n");
  }

  private renderJobCreated(job: DevAgentJob): string {
    return [
      `Job dev cree: ${job.id.slice(0, 8)}`,
      `Type: ${job.jobType}`,
      `Provider: ${job.provider}`,
      "Je te pousserai les mises a jour ici."
    ].join("\n");
  }
}
