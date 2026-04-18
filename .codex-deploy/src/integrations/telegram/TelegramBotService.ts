import { Telegraf } from "telegraf";
import type { ProcessingEventNotifier } from "../n8n/N8nAdapter";
import type { CaptureInboxItemUseCase } from "../../domain/inbox/usecases/CaptureInboxItemUseCase";
import type {
  ProcessInboxItemResult,
  ProcessInboxItemUseCase
} from "../../domain/inbox/usecases/ProcessInboxItemUseCase";

interface TelegramBotOptions {
  token: string | undefined;
  allowedChatIds: Set<string>;
  autoProcess: boolean;
}

export class TelegramBotService {
  private bot: Telegraf | null = null;

  constructor(
    private readonly options: TelegramBotOptions,
    private readonly captureInboxItem: CaptureInboxItemUseCase,
    private readonly processInboxItem: ProcessInboxItemUseCase,
    private readonly notifier?: ProcessingEventNotifier
  ) {}

  async start(): Promise<void> {
    if (!this.options.token) {
      console.log("Telegram bot inactif: TELEGRAM_BOT_TOKEN non configuré.");
      return;
    }

    this.bot = new Telegraf(this.options.token);

    this.bot.start(async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) {
        return;
      }

      await ctx.reply(
        [
          "Bienvenue dans Fusion.",
          "Envoie-moi un message simple et je le capture dans l'inbox.",
          "Commande utile: /id pour afficher ton chat_id Telegram."
        ].join("\n")
      );
    });

    this.bot.command("id", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) {
        return;
      }

      await ctx.reply(`Ton chat_id Fusion est: ${ctx.chat.id}`);
    });

    this.bot.on("text", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) {
        return;
      }

      const chatId = String(ctx.chat.id);
      const text = ctx.message.text?.trim();
      if (!text) {
        await ctx.reply("Message vide, rien à capturer.");
        return;
      }

      if (text.startsWith("/")) {
        await ctx.reply("Commande non reconnue. Utilise /start ou envoie-moi un message simple.");
        return;
      }

      try {
        const inboxItem = await this.captureInboxItem.execute({
          source: "telegram",
          content: text,
          userId: String(ctx.chat.id),
          externalRef: String(ctx.message.message_id)
        });

        if (!this.options.autoProcess) {
          await ctx.reply(`Inbox capturée: ${inboxItem.id}`);
          return;
        }

        const result = await this.processInboxItem.execute(inboxItem.id);
        if (this.notifier) {
          await this.notifier.notifyInboxProcessed(result);
        }
        await ctx.reply(this.renderProcessingResult(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        await ctx.reply(`Erreur Fusion: ${message}`);
      }
    });

    await this.bot.launch();
    console.log("Telegram bot lancé.");
  }

  async stop(): Promise<void> {
    if (!this.bot) {
      return;
    }
    this.bot.stop("shutdown");
    this.bot = null;
  }

  private async ensureAuthorizedChat(ctx: {
    chat: { id: number };
    reply: (message: string) => Promise<unknown>;
  }): Promise<boolean> {
    const chatId = String(ctx.chat.id);
    if (this.options.allowedChatIds.size > 0 && !this.options.allowedChatIds.has(chatId)) {
      await ctx.reply("Chat non autorisé pour Fusion.");
      return false;
    }

    return true;
  }

  private renderProcessingResult(result: ProcessInboxItemResult): string {
    const lines = [
      `Inbox traitée en: ${result.classification.bucket}`,
      `Raison: ${result.classification.reason}`,
      `Confiance: ${Math.round(result.classification.confidence * 100)}%`
    ];

    if (result.projectId) {
      lines.push(`Projet créé: ${result.projectId}`);
    }
    if (result.taskId) {
      lines.push(`Tâche créée: ${result.taskId}`);
    }

    return lines.join("\n");
  }
}
