import { join } from "path";
import { createServer } from "./api/createServer";
import { env } from "./config/env";
import { CaptureInboxItemUseCase } from "./domain/inbox/usecases/CaptureInboxItemUseCase";
import { ProcessInboxItemUseCase } from "./domain/inbox/usecases/ProcessInboxItemUseCase";
import { closePool, pool } from "./infra/db/pool";
import { PgInboxProcessingGateway } from "./infra/repositories/PgInboxProcessingGateway";
import { PgInboxRepository } from "./infra/repositories/PgInboxRepository";
import { PgProcessingLogRepository } from "./infra/repositories/PgProcessingLogRepository";
import { PgProjectRepository } from "./infra/repositories/PgProjectRepository";
import { PgTaskRepository } from "./infra/repositories/PgTaskRepository";
import { createAiRouter } from "./integrations/ai-router";
import { N8nWebhookNotifier } from "./integrations/n8n/N8nAdapter";
import { HttpOllamaClient } from "./integrations/ollama/OllamaAdapter";
import { ManagerLoop } from "./integrations/orchestrator/ManagerLoop";
import { TelegramBotService } from "./integrations/telegram/TelegramBotService";

async function bootstrap(): Promise<void> {
  const inboxRepository = new PgInboxRepository(pool);
  const projectRepository = new PgProjectRepository(pool);
  const taskRepository = new PgTaskRepository(pool);
  const processingLogRepository = new PgProcessingLogRepository(pool);
  const processingGateway = new PgInboxProcessingGateway();
  const aiRouter = createAiRouter();

  const captureInboxItem = new CaptureInboxItemUseCase(inboxRepository);
  const processInboxItem = new ProcessInboxItemUseCase({
    inboxRepository,
    processingGateway,
    processingLogRepository,
    aiRouter
  });

  const notifier = new N8nWebhookNotifier(env.integrations.n8nWebhookUrl);

  const app = createServer({
    captureInboxItem,
    processInboxItem,
    inboxRepository,
    projectRepository,
    taskRepository,
    processingLogRepository,
    notifier
  });

  const server = app.listen(env.port, env.host, () => {
    console.log(`Fusion API démarrée sur http://${env.host}:${env.port}`);
  });

  // Railway healthchecks should not wait for a blocking DB connection.
  void pool.query("SELECT 1").catch((error) => {
    console.error("Connexion PostgreSQL indisponible au démarrage :", error);
  });

  const telegramBot = new TelegramBotService(
    {
      token: env.telegram.token,
      allowedChatIds: env.telegram.allowedChatIds,
      autoProcess: env.telegram.autoProcess
    },
    captureInboxItem,
    processInboxItem,
    notifier,
    aiRouter,
    projectRepository,
    taskRepository
  );
  try {
    await telegramBot.start();
  } catch (error) {
    console.error("Telegram indisponible au démarrage :", error);
  }

  // ── Ollama health check ──────────────────────────────────────────────────────
  const ollamaClient = new HttpOllamaClient(env.integrations.ollamaBaseUrl);
  const ollamaReady = await ollamaClient.isAvailable();
  console.log(`Ollama disponible: ${ollamaReady ? "oui" : "non"}`);

  // ── Orchestrateur ────────────────────────────────────────────────────────────
  const WORK_DIR = join(process.cwd(), "workspace");
  const KANBAN_PATH = join(WORK_DIR, "KANBAN.md");

  const managerLoop = new ManagerLoop({
    kanbanPath: KANBAN_PATH,
    workDir: WORK_DIR,
    aiRouter,
    maxConcurrentTasks: 3
  });

  managerLoop.on("task_dispatched", (task) => {
    console.log(`[Orchestrateur] → dispatch ${task.id} : ${task.title} (${task.assignee})`);
  });
  managerLoop.on("task_validated", (task) => {
    console.log(`[Orchestrateur] ✅ validé ${task.id} : ${task.title}`);
  });
  managerLoop.on("task_rejected", (task, reason) => {
    console.log(`[Orchestrateur] ❌ rejeté ${task.id} — ${reason}`);
  });
  managerLoop.on("error", (err) => {
    console.error("[Orchestrateur] erreur:", err.message);
  });

  managerLoop.start();
  console.log(`[Orchestrateur] démarré — surveille ${KANBAN_PATH}`);

  const shutdown = async (signal: string) => {
    console.log(`Signal ${signal} reçu, arrêt en cours...`);
    managerLoop.stop();
    server.close();
    await telegramBot.stop();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  console.error("Erreur au démarrage de Fusion:", error);
  process.exit(1);
});
