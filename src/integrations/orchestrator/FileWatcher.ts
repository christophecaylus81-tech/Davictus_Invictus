import chokidar, { type FSWatcher } from "chokidar";
import { readFile } from "fs/promises";
import { EventEmitter } from "events";
import { MdParser } from "./MdParser";
import type { AgentId, Kanban, KanbanTask, TaskStatus } from "./types";

export interface TaskEvent {
  type: "task_ready" | "task_note" | "task_review";
  task: KanbanTask;
  kanban: Kanban;
}

export interface KanbanChangedEvent {
  previous: Kanban | null;
  current: Kanban;
  newTasksByStatus: Record<TaskStatus, KanbanTask[]>;
}

export declare interface FileWatcher {
  on(event: "task_ready", listener: (e: TaskEvent) => void): this;
  on(event: "task_review", listener: (e: TaskEvent) => void): this;
  on(event: "kanban_changed", listener: (e: KanbanChangedEvent) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private previous: Kanban | null = null;
  private readonly parser = new MdParser();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300;

  constructor(private readonly kanbanPath: string) {
    super();
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.kanbanPath, {
      persistent: true,
      ignoreInitial: false,  // Lire l'état initial au démarrage
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50
      }
    });

    this.watcher.on("add", () => void this.handleChange());
    this.watcher.on("change", () => void this.handleChange());
    this.watcher.on("error", (err) => this.emit("error", err));
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    void this.watcher?.close();
    this.watcher = null;
  }

  // ── Détection des changements ───────────────────────────────────────────────

  private handleChange(): void {
    // Debounce — évite les doubles triggers sur save
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.processChange(), this.DEBOUNCE_MS);
  }

  private async processChange(): Promise<void> {
    try {
      const content = await readFile(this.kanbanPath, "utf-8");
      const current = this.parser.parseKanban(content);
      const diff = this.diff(this.previous, current);

      this.emit("kanban_changed", {
        previous: this.previous,
        current,
        newTasksByStatus: diff
      });

      // Émettre les événements ciblés
      for (const task of diff.todo) {
        this.emit("task_ready", { type: "task_ready", task, kanban: current });
      }
      for (const task of diff.review) {
        this.emit("task_review", { type: "task_review", task, kanban: current });
      }

      this.previous = current;
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ── Diff entre deux états du Kanban ────────────────────────────────────────

  private diff(prev: Kanban | null, current: Kanban): Record<TaskStatus, KanbanTask[]> {
    const result: Record<TaskStatus, KanbanTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      rejected: []
    };

    if (!prev) {
      // Démarrage : toutes les tâches todo sont "prêtes"
      result.todo = current.tasks.filter((t) => t.status === "todo");
      result.review = current.tasks.filter((t) => t.status === "review");
      return result;
    }

    const prevById = new Map(prev.tasks.map((t) => [t.id, t]));

    for (const task of current.tasks) {
      const prevTask = prevById.get(task.id);

      // Nouvelle tâche ou changement de statut
      if (!prevTask || prevTask.status !== task.status) {
        result[task.status].push(task);
      }
    }

    return result;
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────────

  async readCurrent(): Promise<Kanban | null> {
    try {
      const content = await readFile(this.kanbanPath, "utf-8");
      return this.parser.parseKanban(content);
    } catch {
      return null;
    }
  }

  getTasksForAgent(kanban: Kanban, agent: AgentId): KanbanTask[] {
    return this.parser.getTasksByAgent(kanban, agent);
  }
}
