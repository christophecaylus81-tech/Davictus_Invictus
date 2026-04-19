import { join } from "path";
import { createServer } from "./api/createServer";
import { env } from "./config/env";
import { CaptureInboxItemUseCase } from "./domain/inbox/usecases/CaptureInboxItemUseCase";
import { ProcessInboxItemUseCase } from "./domain/inbox/usecases/ProcessInboxItemUseCase";
import { closePool, pool } from "./infra/db/pool";
import { PgDevAgentJobRepository } from "./infra/repositories/PgDevAgentJobRepository";
import { PgInboxProcessingGateway } from "./infra/repositories/PgInboxProcessingGateway";
import { PgInboxRepository } from "./infra/repositories/PgInboxRepository";
import { PgProcessingLogRepository } from "./infra/repositories/PgProcessingLogRepository";
import { PgProjectRepository } from "./infra/repositories/PgProjectRepository";
import { PgTaskRepository } from "./infra/repositories/PgTaskRepository";
import { PgTelegramUserRepository } from "./infra/repositories/PgTelegramUserRepository";
import { PgCredentialRepository } from "./infra/repositories/PgCredentialRepository";
import { createAiRouter } from "./integrations/ai-router";
import { DeepSeekAdapter } from "./integrations/ai-router/adapters/DeepSeekAdapter";
import { ClaudeAdapter } from "./integrations/ai-router/adapters/ClaudeAdapter";
import { OpenAiAdapter } from "./integrations/ai-router/adapters/OpenAiAdapter";
import { GeminiAdapter } from "./integrations/ai-router/adapters/GeminiAdapter";
import { QwenAdapter } from "./integrations/ai-router/adapters/QwenAdapter";
import { DeveloperControlService } from "./integrations/dev-agent/DeveloperControlService";
import { GoogleAuthService } from "./integrations/google/GoogleAuthService";
import { GmailService } from "./integrations/google/GmailService";
import { GoogleCalendarService } from "./integrations/google/GoogleCalendarService";
import { GoogleTasksService } from "./integrations/google/GoogleTasksService";
import { ManagerService } from "./integrations/manager/ManagerService";
import { N8nWebhookNotifier } from "./integrations/n8n/N8nAdapter";
import { HttpOllamaClient } from "./integrations/ollama/OllamaAdapter";
import { ManagerLoop } from "./integrations/orchestrator/ManagerLoop";
import { TelegramBotService } from "./integrations/telegram/TelegramBotService";
import { OpenAiSpeechToTextService } from "./integrations/voice/OpenAiSpeechToTextService";

async function bootstrap(): Promise<void> {
  const inboxRepository = new PgInboxRepository(pool);
  const projectRepository = new PgProjectRepository(pool);
  const taskRepository = new PgTaskRepository(pool);
  const userRepository = new PgTelegramUserRepository(pool);
  const credentialRepository = new PgCredentialRepository(pool);
  const processingLogRepository = new PgProcessingLogRepository(pool);
  const devAgentJobRepository = new PgDevAgentJobRepository(pool);
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
  const speechToText = env.integrations.openaiApiKey
    ? new OpenAiSpeechToTextService(
        env.integrations.openaiApiKey,
        env.integrations.openaiBaseUrl,
        env.integrations.openaiTranscribeModel
      )
    : undefined;
  const WORK_DIR = join(process.cwd(), "workspace");
  const KANBAN_PATH = join(WORK_DIR, "KANBAN.md");
  const developerControl = new DeveloperControlService(devAgentJobRepository, KANBAN_PATH);

  const googleAuth = new GoogleAuthService(credentialRepository);
  const gmailService = new GmailService(googleAuth);
  const calendarService = new GoogleCalendarService(googleAuth);
  const googleTasksService = new GoogleTasksService(googleAuth);

  // ── Adapters IA ──────────────────────────────────────────────────────────────
  const gptAdapter = env.integrations.openaiApiKey
    ? new OpenAiAdapter(env.integrations.openaiApiKey, env.integrations.openaiManagerModel, env.integrations.openaiBaseUrl)
    : undefined;
  const deepseekAdapter = env.integrations.deepseekApiKey
    ? new DeepSeekAdapter(env.integrations.deepseekApiKey, env.integrations.deepseekBaseUrl)
    : undefined;
  const claudeAdapter = env.integrations.anthropicApiKey
    ? new ClaudeAdapter(env.integrations.anthropicApiKey)
    : undefined;
  const qwenCoderAdapter = env.integrations.qwenApiKey
    ? new QwenAdapter(env.integrations.qwenApiKey, env.integrations.qwenBaseUrl, env.integrations.qwenCoderModel)
    : undefined;
  const geminiFlashAdapter = env.integrations.geminiApiKey
    ? new GeminiAdapter(env.integrations.geminiApiKey, env.integrations.geminiFlashModel)
    : undefined;
  const geminiProAdapter = env.integrations.geminiApiKey
    ? new GeminiAdapter(env.integrations.geminiApiKey, env.integrations.geminiProModel)
    : undefined;

  // ── Manager (au moins GPT ou DeepSeek requis, reste optionnel) ──────────────
  const managerGpt = gptAdapter ?? deepseekAdapter;
  const managerService = managerGpt
    ? new ManagerService(
        {
          gpt: managerGpt,
          ...(qwenCoderAdapter   ? { qwenCoder:    qwenCoderAdapter   } : {}),
          ...(geminiFlashAdapter ? { geminiFlash:  geminiFlashAdapter } : {}),
          ...(geminiProAdapter   ? { geminiPro:    geminiProAdapter   } : {}),
          ...(claudeAdapter      ? { claude:       claudeAdapter      } : {}),
        },
        developerControl
      )
    : undefined;

  if (managerService) {
    const active = [
      'gpt/' + (gptAdapter ? env.integrations.openaiManagerModel : 'deepseek'),
      qwenCoderAdapter   ? 'qwen-coder'   : null,
      geminiFlashAdapter ? 'gemini-flash' : null,
      geminiProAdapter   ? 'gemini-pro'   : null,
      claudeAdapter      ? 'claude'       : null,
    ].filter(Boolean).join(', ')
    console.log(`[Manager] Actif — équipe : ${active}`)
  } else {
    console.warn('[Manager] Inactif — requis : DEEPSEEK_API_KEY ou OPENAI_API_KEY')
  }

  const app = createServer({
    captureInboxItem,
    processInboxItem,
    inboxRepository,
    projectRepository,
    taskRepository,
    processingLogRepository,
    devAgentJobRepository,
    credentialRepository,
    notifier
  });

  const server = app.listen(env.port, env.host, () => {
    console.log(`Fusion API démarrée sur http://${env.host}:${env.port}`);
  });

  // Non-bloquant : Railway healthcheck passe sans attendre la DB
  void pool.query("SELECT 1").catch((error) => {
    console.error("Connexion PostgreSQL indisponible au démarrage :", error);
  });

  const telegramBot = new TelegramBotService(
    {
      token: env.telegram.token,
      adminChatIds: env.telegram.allowedChatIds,
      autoProcess: env.telegram.autoProcess
    },
    captureInboxItem,
    processInboxItem,
    notifier,
    aiRouter,
    projectRepository,
    taskRepository,
    speechToText,
    userRepository,
    developerControl,
    gmailService,
    calendarService,
    googleTasksService,
    managerService,
    qwenCoderAdapter ?? undefined,
    WORK_DIR
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
  console.log(`Transcription vocale: ${speechToText ? "configurée" : "non configurée"}`);

  // ── Orchestrateur ────────────────────────────────────────────────────────────
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

  // Injecter le callback de notification Telegram dans le ManagerLoop
  managerLoop.setNotifyCallback((msg) => telegramBot.broadcastToAdmins(msg));

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
