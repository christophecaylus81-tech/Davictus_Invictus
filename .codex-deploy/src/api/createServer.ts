import express, { type NextFunction, type Request, type Response } from "express";
import type { InboxSource } from "../domain/inbox/types";
import type { CaptureInboxItemUseCase } from "../domain/inbox/usecases/CaptureInboxItemUseCase";
import type {
  ProcessInboxItemUseCase
} from "../domain/inbox/usecases/ProcessInboxItemUseCase";
import type { InboxRepository } from "../domain/inbox/repositories";
import type { ProjectRepository } from "../domain/projects/repositories";
import type { TaskRepository } from "../domain/tasks/repositories";
import type { ProcessingLogRepository } from "../domain/logs/repositories";
import type { ProcessingEventNotifier } from "../integrations/n8n/N8nAdapter";
import { env } from "../config/env";
import { moduleRegistry } from "../modules/moduleRegistry";
import { renderDashboardPage } from "./renderDashboardPage";

interface ServerDependencies {
  captureInboxItem: CaptureInboxItemUseCase;
  processInboxItem: ProcessInboxItemUseCase;
  inboxRepository: InboxRepository;
  projectRepository: ProjectRepository;
  taskRepository: TaskRepository;
  processingLogRepository: ProcessingLogRepository;
  notifier?: ProcessingEventNotifier;
}

interface CreateInboxBody {
  source?: InboxSource;
  userId?: string;
  externalRef?: string;
  content?: string;
  processNow?: boolean;
}

function parseLimit(rawValue: unknown, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

function countByStatus<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>
  );
}

export function createServer(deps: ServerDependencies) {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.redirect("/dashboard");
  });

  app.get("/dashboard", (_req, res) => {
    res.type("html").send(renderDashboardPage());
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "fusion-mvp",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/modules", (_req, res) => {
    res.json({
      modules: moduleRegistry
    });
  });

  app.get(
    "/api/dashboard/overview",
    asyncHandler(async (_req, res) => {
      const [inboxItems, projects, tasks] = await Promise.all([
        deps.inboxRepository.listRecent(200),
        deps.projectRepository.list(200),
        deps.taskRepository.list({ limit: 200 })
      ]);

      const inboxCounts = countByStatus(inboxItems.map((item) => item.status));
      const projectCounts = countByStatus(projects.map((project) => project.status));
      const taskCounts = countByStatus(tasks.map((task) => task.status));

      res.json({
        generatedAt: new Date().toISOString(),
        health: {
          status: "ok",
          service: "fusion-mvp"
        },
        telegram: {
          configured: Boolean(env.telegram.token),
          allowedChatIdsCount: env.telegram.allowedChatIds.size,
          autoProcess: env.telegram.autoProcess
        },
        counts: {
          inbox: {
            total: inboxItems.length,
            captured: inboxCounts.captured ?? 0,
            processed: inboxCounts.processed ?? 0,
            archived: inboxCounts.archived ?? 0
          },
          projects: {
            total: projects.length,
            active: projectCounts.active ?? 0,
            completed: projectCounts.completed ?? 0,
            onHold: projectCounts.on_hold ?? 0
          },
          tasks: {
            total: tasks.length,
            todo: taskCounts.todo ?? 0,
            next: taskCounts.next ?? 0,
            inProgress: taskCounts.in_progress ?? 0,
            done: taskCounts.done ?? 0
          }
        },
        recentInbox: inboxItems.slice(0, 8),
        recentProjects: projects.slice(0, 6),
        recentTasks: tasks.slice(0, 6),
        modules: moduleRegistry
      });
    })
  );

  app.post(
    "/api/inbox",
    asyncHandler(async (req, res) => {
      const body = req.body as CreateInboxBody;
      const item = await deps.captureInboxItem.execute({
        source: body.source ?? "api",
        userId: body.userId ?? null,
        externalRef: body.externalRef ?? null,
        content: body.content ?? ""
      });

      if (body.processNow) {
        const processingResult = await deps.processInboxItem.execute(item.id);
        if (deps.notifier) {
          await deps.notifier.notifyInboxProcessed(processingResult);
        }
        res.status(201).json({
          inboxItem: item,
          processingResult
        });
        return;
      }

      res.status(201).json({ inboxItem: item });
    })
  );

  app.post(
    "/api/inbox/:id/process",
    asyncHandler(async (req, res) => {
      const inboxId = req.params.id;
      if (!inboxId) {
        throw new Error("Identifiant inbox manquant.");
      }

      const result = await deps.processInboxItem.execute(inboxId);
      if (deps.notifier) {
        await deps.notifier.notifyInboxProcessed(result);
      }
      res.json(result);
    })
  );

  app.get(
    "/api/inbox",
    asyncHandler(async (req, res) => {
      const limit = parseLimit(req.query.limit, 50);
      const items = await deps.inboxRepository.listRecent(limit);
      res.json({ items });
    })
  );

  app.get(
    "/api/inbox/:id/logs",
    asyncHandler(async (req, res) => {
      const inboxId = req.params.id;
      if (!inboxId) {
        throw new Error("Identifiant inbox manquant.");
      }
      const limit = parseLimit(req.query.limit, 100);
      const logs = await deps.processingLogRepository.listByInboxItem(inboxId, limit);
      res.json({ logs });
    })
  );

  app.get(
    "/api/projects",
    asyncHandler(async (req, res) => {
      const limit = parseLimit(req.query.limit, 50);
      const projects = await deps.projectRepository.list(limit);
      res.json({ projects });
    })
  );

  app.get(
    "/api/tasks",
    asyncHandler(async (req, res) => {
      const limit = parseLimit(req.query.limit, 50);
      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
      const tasks = await deps.taskRepository.list(
        projectId ? { limit, projectId } : { limit }
      );
      res.json({ tasks });
    })
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    const statusCode = message.includes("introuvable")
      ? 404
      : message.includes("déjà traité")
        ? 409
        : 400;

    res.status(statusCode).json({
      error: message
    });
  });

  return app;
}
