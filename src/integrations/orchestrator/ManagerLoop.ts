import { EventEmitter } from "events";
import type { AiRouter } from "../ai-router/AiRouter";
import { FileWatcher } from "./FileWatcher";
import { MdWriter } from "./MdWriter";
import { TaskDispatcher } from "./TaskDispatcher";
import type { Kanban, KanbanTask } from "./types";

export interface ManagerLoopConfig {
  kanbanPath: string;
  workDir: string;
  aiRouter: AiRouter;
  maxConcurrentTasks?: number | undefined;
}

export declare interface ManagerLoop {
  on(event: "task_dispatched", listener: (task: KanbanTask) => void): this;
  on(event: "task_validated", listener: (task: KanbanTask) => void): this;
  on(event: "task_rejected", listener: (task: KanbanTask, reason: string) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

export class ManagerLoop extends EventEmitter {
  private readonly watcher: FileWatcher;
  private readonly dispatcher: TaskDispatcher;
  private readonly writer: MdWriter;
  private readonly maxConcurrent: number;
  private activeDispatches = new Set<string>(); // task IDs en cours
  private pendingReadyTaskIds: string[] = [];

  constructor(private readonly config: ManagerLoopConfig) {
    super();
    this.watcher = new FileWatcher(config.kanbanPath);
    this.dispatcher = new TaskDispatcher(config.aiRouter, config.workDir);
    this.writer = new MdWriter(config.workDir);
    this.maxConcurrent = config.maxConcurrentTasks ?? 3;
  }

  start(): void {
    // Tâches prêtes → dispatcher
    this.watcher.on("task_ready", ({ task }) => {
      this.queueReadyTask(task.id);
      void this.drainReadyTasks();
    });

    // Tâches en review → évaluation Manager
    this.watcher.on("task_review", ({ task, kanban }) => {
      void this.handleTaskReview(task, kanban);
    });

    this.watcher.on("error", (err) => this.emit("error", err));

    this.watcher.start();
  }

  stop(): void {
    this.pendingReadyTaskIds = [];
    this.watcher.stop();
  }

  private queueReadyTask(taskId: string): void {
    if (this.activeDispatches.has(taskId)) return;
    if (this.pendingReadyTaskIds.includes(taskId)) return;
    this.pendingReadyTaskIds.push(taskId);
  }

  private async drainReadyTasks(): Promise<void> {
    while (
      this.activeDispatches.size < this.maxConcurrent &&
      this.pendingReadyTaskIds.length > 0
    ) {
      const nextTaskId = this.pendingReadyTaskIds.shift();
      if (!nextTaskId || this.activeDispatches.has(nextTaskId)) {
        continue;
      }

      const currentKanban = await this.watcher.readCurrent();
      if (!currentKanban) {
        continue;
      }

      const task = currentKanban.tasks.find((candidate) => candidate.id === nextTaskId);
      if (!task || task.status !== "todo") {
        continue;
      }

      void this.handleTaskReady(task, currentKanban);
    }
  }

  // ── Dispatch d'une tâche prête ──────────────────────────────────────────────

  private async handleTaskReady(task: KanbanTask, kanban: Kanban): Promise<void> {
    if (this.activeDispatches.has(task.id)) return;
    this.pendingReadyTaskIds = this.pendingReadyTaskIds.filter((id) => id !== task.id);

    this.activeDispatches.add(task.id);
    this.emit("task_dispatched", task);

    try {
      await this.dispatcher.dispatch(task, kanban);
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.activeDispatches.delete(task.id);
      void this.drainReadyTasks();
    }
  }

  // ── Évaluation Manager d'une tâche en review ───────────────────────────────

  private async handleTaskReview(task: KanbanTask, kanban: Kanban): Promise<void> {
    if (this.activeDispatches.has(`review:${task.id}`)) return;

    this.activeDispatches.add(`review:${task.id}`);

    try {
      const { satisfied, reason } = await this.dispatcher.evaluate(task, kanban);

      let updated = kanban;

      if (satisfied) {
        // Valider la tâche
        updated = this.writer.validateTask(kanban, task.id);
        await this.writer.writeKanban(updated);
        await this.writer.appendMemory({
          timestamp: this.now(),
          actor: "MANAGER",
          type: "verdict",
          detail: `${task.id} satisfaisant ✅ — ${reason}`
        });
        this.emit("task_validated", task);

      } else {
        // Rejeter et réassigner si besoin
        updated = this.writer.rejectTask(kanban, task.id, reason);

        // Créer une nouvelle tâche corrigée
        const newId = this.writer.nextTaskId(updated);
        updated = this.writer.addTask(updated, {
          id: newId,
          title: task.title,
          assignee: task.assignee,
          promptManager: `${task.promptManager}\n\n⚠️ CORRECTION REQUISE: ${reason}`,
          status: "todo",
          reportRequested: task.reportRequested
        });

        await this.writer.writeKanban(updated);
        await this.writer.appendMemory({
          timestamp: this.now(),
          actor: "MANAGER",
          type: "rejet",
          detail: `${task.id} rejeté → ${newId} créé. Raison: ${reason}`
        });
        this.emit("task_rejected", task, reason);
      }

    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.activeDispatches.delete(`review:${task.id}`);
    }
  }

  private now(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 16);
  }
}
