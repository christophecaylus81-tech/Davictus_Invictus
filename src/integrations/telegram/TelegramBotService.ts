import { Telegraf } from "telegraf";
import type { CaptureInboxItemUseCase } from "../../domain/inbox/usecases/CaptureInboxItemUseCase";
import type { ProcessInboxItemUseCase } from "../../domain/inbox/usecases/ProcessInboxItemUseCase";
import type { ProjectRepository } from "../../domain/projects/repositories";
import type { Project } from "../../domain/projects/types";
import type { TaskRepository } from "../../domain/tasks/repositories";
import type { TelegramUserRepository } from "../../domain/users/repositories";
import type { AiRouter } from "../ai-router/AiRouter";
import { DeveloperControlService } from "../dev-agent/DeveloperControlService";
import type { GmailService } from "../google/GmailService";
import type { GoogleCalendarService } from "../google/GoogleCalendarService";
import type { GoogleTasksService } from "../google/GoogleTasksService";
import type { ManagerService } from "../manager/ManagerService";
import type { ProcessingEventNotifier } from "../n8n/N8nAdapter";
import { ConversationManager } from "./ConversationManager";
import { buildSystemPrompt, parseDavitusResponse } from "./DavitusPrompt";
import type { SpeechToTextService } from "../voice/OpenAiSpeechToTextService";

interface TelegramBotOptions {
  token: string | undefined;
  adminChatIds: Set<string>;
  autoProcess: boolean;
}

interface ReplyContext {
  reply: (message: string) => Promise<unknown>;
}

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private readonly conversations = new ConversationManager();
  private readonly jobWatchers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly options: TelegramBotOptions,
    private readonly captureInboxItem: CaptureInboxItemUseCase,
    private readonly processInboxItem: ProcessInboxItemUseCase,
    private readonly notifier?: ProcessingEventNotifier,
    private readonly aiRouter?: AiRouter,
    private readonly projectRepository?: ProjectRepository,
    private readonly taskRepository?: TaskRepository,
    private readonly speechToText?: SpeechToTextService,
    private readonly userRepository?: TelegramUserRepository,
    private readonly developerControl?: DeveloperControlService,
    private readonly gmailService?: GmailService,
    private readonly calendarService?: GoogleCalendarService,
    private readonly googleTasksService?: GoogleTasksService,
    private readonly managerService?: ManagerService
  ) {}

  async start(): Promise<void> {
    if (!this.options.token) {
      console.log("Telegram bot inactif: TELEGRAM_BOT_TOKEN non configure.");
      return;
    }

    this.bot = new Telegraf(this.options.token);

    this.bot.start(async (ctx) => {
      const chatId = String(ctx.chat.id);
      const firstName = ctx.from?.first_name ?? "Mortel";

      if (this.isAdmin(chatId)) {
        await this.ensureAdminRegistered(chatId, firstName);
        await ctx.reply(
          [
            "Davitus en ligne.",
            "",
            "⚡ Données Google",
            "/briefing - résumé du jour (emails + agenda)",
            "/inbox - emails non lus",
            "/agenda - événements du jour",
            "/traiter - Manager analyse l'inbox et crée les tâches",
            "",
            "🗂 GTD & Projets",
            "/project - voir ou changer de projet",
            "/jobs - jobs dev récents",
            "/job <id> - suivre un job",
            "",
            "👥 Admin",
            "/users - gérer les accès",
            "/adduser <id> <nom> - ajouter un utilisateur",
            "/clear - réinitialiser la conversation"
          ].join("\n")
        );
        return;
      }

      const authorized = await this.userRepository?.isAuthorized(chatId) ?? false;
      if (!authorized) {
        await ctx.reply(
          [
            "Ton identite n'est pas encore autorisee.",
            "",
            `Chat ID : ${chatId}`,
            "Demande a l'administrateur de t'ajouter."
          ].join("\n")
        );
        return;
      }

      await ctx.reply(`Je te vois, ${firstName}. Parle.`);
    });

    this.bot.command("id", async (ctx) => {
      await ctx.reply(`Chat ID : ${ctx.chat.id}`);
    });

    this.bot.command("clear", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      this.conversations.clear(String(ctx.chat.id));
      await ctx.reply("Les echos de cette journee sont effaces.");
    });

    this.bot.command("users", async (ctx) => {
      if (!this.isAdmin(String(ctx.chat.id))) return;
      const users = await this.userRepository?.list() ?? [];
      if (users.length === 0) {
        await ctx.reply("Aucun utilisateur enregistre.");
        return;
      }
      const lines = users.map((user) => `${user.status === "active" ? "OK" : "OFF"} ${user.name} - ${user.chatId} (${user.role})`);
      await ctx.reply(`Utilisateurs :\n\n${lines.join("\n")}`);
    });

    this.bot.command("adduser", async (ctx) => {
      if (!this.isAdmin(String(ctx.chat.id))) return;
      const args = ctx.message.text.replace(/^\/adduser(@\w+)?\s*/i, "").trim().split(/\s+/);
      const targetId = args[0];
      const name = args.slice(1).join(" ") || "Utilisateur";

      if (!targetId) {
        await ctx.reply("Usage : /adduser <chat_id> <nom>");
        return;
      }

      await this.userRepository?.add(targetId, name, String(ctx.chat.id));
      await ctx.reply(`OK ${name} (${targetId}) ajoute aux registres.`);
    });

    this.bot.command("removeuser", async (ctx) => {
      if (!this.isAdmin(String(ctx.chat.id))) return;
      const targetId = ctx.message.text.replace(/^\/removeuser(@\w+)?\s*/i, "").trim();

      if (!targetId) {
        await ctx.reply("Usage : /removeuser <chat_id>");
        return;
      }

      await this.userRepository?.setStatus(targetId, "blocked");
      await ctx.reply(`Acces revoque pour ${targetId}.`);
    });

    this.bot.command("project", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      const chatId = String(ctx.chat.id);
      const raw = ctx.message.text?.replace(/^\/project(@\w+)?/i, "").trim() ?? "";

      if (!raw) {
        await ctx.reply(await this.renderProjectStatus(chatId));
        return;
      }

      if (["clear", "off", "none", "aucun"].includes(raw.toLowerCase())) {
        this.conversations.clearCurrentProject(chatId);
        await ctx.reply("Projet courant retire. Retour en mode general.");
        return;
      }

      await ctx.reply(await this.switchConversationProject(chatId, raw));
    });

    this.bot.command("traiter", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      if (!this.managerService) {
        await ctx.reply("Le Manager IA n'est pas configuré.\nRequis dans l'Admin : (OPENAI_API_KEY ou DEEPSEEK_API_KEY) + QWEN_API_KEY + GEMINI_API_KEY");
        return;
      }
      if (!this.gmailService) {
        await ctx.reply("Gmail n'est pas connecté.");
        return;
      }
      await ctx.reply("Traitement de l'inbox en cours...");
      await this.processInboxWithManager(ctx);
    });

    this.bot.command("briefing", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      await ctx.reply("Consultation des astres en cours...");
      const data = await this.fetchGoogleContext('briefing').catch(() => null)
      if (!data) {
        await ctx.reply("Les connexions Google ne répondent pas. Vérifie la configuration dans l'Admin.");
        return;
      }
      await ctx.reply(data || "Rien à signaler dans tes flux Google.");
    });

    this.bot.command("agenda", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      const data = await this.fetchGoogleContext('calendar').catch(() => null)
      await ctx.reply(data || "Agenda vide ou service indisponible.");
    });

    this.bot.command("inbox", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      const data = await this.fetchGoogleContext('gmail').catch(() => null)
      await ctx.reply(data || "Inbox vide ou service indisponible.");
    });

    this.bot.command("jobs", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      if (!this.developerControl) {
        await ctx.reply("Le controle dev n'est pas configure.");
        return;
      }

      await ctx.reply(await this.developerControl.listRecentJobs(String(ctx.chat.id)));
    });

    this.bot.command("job", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;
      if (!this.developerControl) {
        await ctx.reply("Le controle dev n'est pas configure.");
        return;
      }

      const raw = ctx.message.text?.replace(/^\/job(@\w+)?/i, "").trim() ?? "";
      if (!raw) {
        await ctx.reply("Usage : /job <id>");
        return;
      }

      const jobId = raw.trim();
      const snapshot = await this.developerControl.getJobUpdates(jobId, 0);
      if (!snapshot.job) {
        await ctx.reply("Job introuvable.");
        return;
      }

      const rendered = this.developerControl.formatJobUpdate(snapshot.job, snapshot.events)
        ?? `Job ${snapshot.job.id.slice(0, 8)} - ${snapshot.job.status}`;
      await ctx.reply(rendered);
      this.watchJob(jobId, String(ctx.chat.id), ctx);
    });

    this.bot.on("text", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;

      const text = ctx.message.text?.trim();
      if (!text || text.startsWith("/")) return;

      const chatId = String(ctx.chat.id);
      // Assignation de tâches en attente (réponse après /traiter)
      if (this._pendingUnassignedTasks.length > 0) {
        const handled = await this.tryAssignPendingTasks(ctx, chatId, text)
        if (handled) return
      }

      const switchReply = await this.tryHandleProjectSwitch(chatId, text);
      if (switchReply) {
        await ctx.reply(switchReply);
        return;
      }

      const devHandled = await this.tryHandleDeveloperRequest(ctx, chatId, text);
      if (devHandled) {
        return;
      }

      await this.processIncomingText(ctx, chatId, text);
    });

    this.bot.on("voice", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;

      const chatId = String(ctx.chat.id);
      const voice = ctx.message.voice;
      await this.handleVoiceLikeMessage(ctx, chatId, {
        fileId: voice.file_id,
        fileName: `telegram-voice-${voice.file_unique_id}.ogg`,
        ...(voice.mime_type ? { mimeType: voice.mime_type } : {})
      });
    });

    this.bot.on("audio", async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return;

      const chatId = String(ctx.chat.id);
      const audio = ctx.message.audio;
      const fallbackExtension = audio.mime_type?.includes("mpeg") ? "mp3" : "m4a";
      await this.handleVoiceLikeMessage(ctx, chatId, {
        fileId: audio.file_id,
        fileName: audio.file_name ?? `telegram-audio-${audio.file_unique_id}.${fallbackExtension}`,
        ...(audio.mime_type ? { mimeType: audio.mime_type } : {})
      });
    });

    this.bot.launch().catch((error) => console.error("[Telegram] Erreur launch:", error));
    console.log("Telegram bot lance (mode conversationnel).");
  }

  async stop(): Promise<void> {
    for (const watcher of this.jobWatchers.values()) {
      clearInterval(watcher);
    }
    this.jobWatchers.clear();

    if (!this.bot) return;
    this.bot.stop("shutdown");
    this.bot = null;
  }

  private async tryHandleDeveloperRequest(ctx: ReplyContext, chatId: string, text: string): Promise<boolean> {
    if (!this.developerControl) {
      return false;
    }

    const result = await this.developerControl.handleMessage({
      chatId,
      text,
      currentProject: this.conversations.getCurrentProject(chatId)
    });

    if (!result) {
      return false;
    }

    await ctx.reply(result.reply);
    if (result.jobId) {
      this.watchJob(result.jobId, chatId, ctx);
    }
    return true;
  }

  private watchJob(jobId: string, chatId: string, ctx: ReplyContext): void {
    const watcherKey = `${chatId}:${jobId}`;
    const existing = this.jobWatchers.get(watcherKey);
    if (existing) {
      clearInterval(existing);
    }

    let lastSequence = 0;
    const interval = setInterval(() => {
      void (async () => {
        if (!this.developerControl) return;

        const snapshot = await this.developerControl.getJobUpdates(jobId, lastSequence);
        if (!snapshot.job) {
          clearInterval(interval);
          this.jobWatchers.delete(watcherKey);
          return;
        }

        if (snapshot.events.length > 0) {
          lastSequence = snapshot.events[snapshot.events.length - 1]!.sequence;
        }

        const rendered = this.developerControl.formatJobUpdate(snapshot.job, snapshot.events);
        if (rendered) {
          await ctx.reply(rendered);
        }

        if (["completed", "failed", "blocked", "cancelled"].includes(snapshot.job.status)) {
          clearInterval(interval);
          this.jobWatchers.delete(watcherKey);
        }
      })().catch((error) => {
        clearInterval(interval);
        this.jobWatchers.delete(watcherKey);
        console.error("[Davitus] Watch job error:", error);
      });
    }, 5000);

    this.jobWatchers.set(watcherKey, interval);
  }

  private detectGoogleIntent(text: string): 'gmail' | 'calendar' | 'tasks' | 'briefing' | null {
    const t = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const gmailKw = ['mail', 'email', 'gmail', 'inbox', 'message', 'non lu', 'unread', 'boite', 'courriel', 'recu', 'ma boite', 'mes messages', 'courrier', 'mails', 'emails']
    const calendarKw = ['agenda', 'calendrier', 'rdv', 'rendez-vous', 'rendez vous', 'evenement', 'planning', 'reunion', 'reunions', 'horaire', 'emploi du temps', 'programme', 'journee', 'semaine', 'aujourd hui']
    const tasksKw = ['tache google', 'google task', 'mes taches google', 'tasks google']
    const briefingKw = ['briefing', 'brief', 'point du jour', 'quoi de neuf', 'resume du jour', 'etat du jour', 'overview', 'tour d horizon', 'whats up', "qu'est-ce qui se passe"]
    if (briefingKw.some(kw => t.includes(kw))) return 'briefing'
    if (tasksKw.some(kw => t.includes(kw))) return 'tasks'
    if (calendarKw.some(kw => t.includes(kw))) return 'calendar'
    if (gmailKw.some(kw => t.includes(kw))) return 'gmail'
    return null
  }

  private async fetchGoogleContext(intent: 'gmail' | 'calendar' | 'tasks' | 'briefing'): Promise<string> {
    try {
      if (intent === 'briefing') {
        const parts: string[] = []
        if (this.gmailService) {
          const messages = await this.gmailService.getUnreadMessages(5)
          if (messages.length > 0) {
            const lines = messages.map((m, i) =>
              `${i + 1}. *${m.subject}*\n   De: ${this.cleanSender(m.from)}\n   ${m.snippet.slice(0, 100)}`
            )
            parts.push(`*INBOX — ${messages.length} non lus*\n${lines.join('\n\n')}`)
          } else {
            parts.push('*INBOX* : vide.')
          }
        }
        if (this.calendarService) {
          const events = await this.calendarService.getTodayEvents()
          if (events.length > 0) {
            const lines = events.map(e => {
              const time = e.isAllDay ? 'Journée' : `${e.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}–${e.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              return `• ${time} — ${e.title}`
            })
            parts.push(`*AGENDA AUJOURD'HUI*\n${lines.join('\n')}`)
          } else {
            parts.push("*AGENDA* : journée libre.")
          }
        }
        return parts.join('\n\n')
      }

      if (intent === 'gmail' && this.gmailService) {
        const messages = await this.gmailService.getUnreadMessages(10)
        if (messages.length === 0) return '*INBOX* : aucun message non lu.'
        const lines = messages.map((m, i) =>
          `${i + 1}. *${m.subject}*\n   De: ${this.cleanSender(m.from)}\n   ${m.snippet.slice(0, 150)}`
        )
        return `*GMAIL — ${messages.length} messages non lus :*\n\n${lines.join('\n\n')}`
      }

      if (intent === 'calendar' && this.calendarService) {
        const events = await this.calendarService.getTodayEvents()
        if (events.length === 0) return "*AGENDA AUJOURD'HUI* : aucun événement."
        const lines = events.map(e => {
          const time = e.isAllDay
            ? 'Toute la journée'
            : `${e.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${e.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          return `• *${time}* — ${e.title}${e.location ? ` (${e.location})` : ''}`
        })
        return `*AGENDA AUJOURD'HUI :*\n${lines.join('\n')}`
      }

      if (intent === 'tasks' && this.googleTasksService) {
        const tasks = await this.googleTasksService.getAllTasks()
        if (tasks.length === 0) return '*GOOGLE TASKS* : aucune tâche en attente.'
        const lines = tasks.slice(0, 15).map(t =>
          `• [${t.listTitle}] ${t.title}${t.due ? ` _(${t.due.toLocaleDateString('fr-FR')})_` : ''}`
        )
        return `*GOOGLE TASKS — ${tasks.length} tâches :*\n${lines.join('\n')}`
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      console.error('[Davitus] Erreur Google:', msg)
      return `Erreur de connexion Google : ${msg}`
    }
    return ''
  }

  private async processInboxWithManager(ctx: ReplyContext): Promise<void> {
    try {
      const [emails, projects] = await Promise.all([
        this.gmailService!.getUnreadMessages(20),
        this.projectRepository?.listActive?.() ?? []
      ])

      if (emails.length === 0) {
        await ctx.reply("Inbox vide — aucun email non lu.")
        return
      }

      const result = await this.managerService!.processEmailInbox(
        emails,
        projects.map(p => ({ id: p.id, title: p.title }))
      )

      const taskDecisions = result.decisions.filter(d => d.action === 'task')
      const assigned: string[] = []
      const unassignedPending: { id: string; title: string; label: string }[] = []

      for (const decision of taskDecisions) {
        if (!decision.taskTitle) continue
        try {
          const proj = projects.find(p => p.id === decision.projectId)
          const created = await this.taskRepository?.create({
            title: decision.taskTitle,
            ...(proj ? { projectId: proj.id } : {}),
            notes: `Source: email inbox — ${decision.reason}`,
            status: decision.priority === 'high' ? 'next' : 'todo',
          })
          const prio = decision.priority === 'high' ? '🔴' : decision.priority === 'low' ? '⚪' : '🟡'
          if (proj) {
            assigned.push(`${prio} ${decision.taskTitle} → _${proj.title}_`)
          } else if (created) {
            unassignedPending.push({ id: created.id, title: decision.taskTitle, label: `${prio} ${decision.taskTitle}` })
          }
        } catch (err) {
          console.error('[Manager] Erreur création tâche:', err)
        }
      }

      // Rapport
      const lines: string[] = [`*Inbox — ${emails.length} emails analysés*`, '']

      if (assigned.length > 0) {
        lines.push(`*${assigned.length} tâche${assigned.length > 1 ? 's' : ''} assignée${assigned.length > 1 ? 's' : ''} :*`)
        lines.push(...assigned)
      }

      if (result.ignored > 0) {
        lines.push('')
        lines.push(`_${result.ignored} ignoré${result.ignored > 1 ? 's' : ''} (newsletters, promos, notifs auto)_`)
      }

      if (result.summary) {
        lines.push('', `_${result.summary}_`)
      }

      await ctx.reply(lines.join('\n'))

      // Si des tâches n'ont pas de projet → demander à l'humain
      if (unassignedPending.length > 0) {
        this._pendingUnassignedTasks = unassignedPending
        const projectNames = projects.slice(0, 8).map(p => `• ${p.title}`).join('\n')
        await ctx.reply(
          [
            `*${unassignedPending.length} tâche${unassignedPending.length > 1 ? 's' : ''} sans projet assigné :*`,
            ...unassignedPending.map(t => t.label),
            '',
            'À quel projet les rattacher ?',
            '',
            '*Projets actifs :*',
            projectNames || '_Aucun projet actif_',
            '',
            '_Réponds avec le nom du projet ou "aucun" pour laisser sans projet._'
          ].join('\n')
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      console.error('[Manager] processInboxWithManager:', msg)
      await ctx.reply(`Erreur lors du traitement : ${msg}`)
    }
  }

  private _pendingUnassignedTasks: { id: string; title: string; label: string }[] = []

  private async tryAssignPendingTasks(ctx: ReplyContext, _chatId: string, text: string): Promise<boolean> {
    const normalized = text.trim().toLowerCase()
    if (normalized === 'aucun' || normalized === 'non' || normalized === 'skip') {
      this._pendingUnassignedTasks = []
      await ctx.reply("Tâches laissées sans projet.")
      return true
    }

    const projects = await this.projectRepository?.listActive?.() ?? []
    const target = this.findProject(projects, text.trim())

    if (!target) {
      return false
    }

    const pending = [...this._pendingUnassignedTasks]
    this._pendingUnassignedTasks = []

    const lines: string[] = [`*Assignation → ${target.title}*`, '']
    for (const t of pending) {
      try {
        await this.taskRepository?.updateProject(t.id, target.id)
        lines.push(`✓ ${t.title}`)
      } catch {
        lines.push(`✗ ${t.title} (erreur)`)
      }
    }
    lines.push('', `_${pending.length} tâche${pending.length > 1 ? 's' : ''} assignée${pending.length > 1 ? 's' : ''} au projet ${target.title}_`)
    await ctx.reply(lines.join('\n'))
    return true
  }

  private cleanSender(from: string): string {
    // "John Doe <john@example.com>" → "John Doe"
    const match = from.match(/^"?([^"<]+)"?\s*</)
    return match ? match[1]!.trim() : from.split('@')[0] ?? from
  }

  private async handleConversational(
    ctx: ReplyContext,
    chatId: string,
    text: string,
    mode: "text" | "voice" = "text"
  ): Promise<void> {
    try {
      const [projects, tasks] = await Promise.all([
        this.projectRepository?.listActive?.() ?? [],
        this.taskRepository?.listActive?.() ?? []
      ]);

      this.conversations.add(chatId, "user", text);
      const history = this.conversations.get(chatId);
      const currentProject = this.conversations.getCurrentProject(chatId);
      const systemPrompt = buildSystemPrompt(projects, tasks, currentProject, new Date());
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
      ];

      // Inject live Google data if intent detected
      const intent = this.detectGoogleIntent(text)
      let hasGoogleData = false
      if (intent) {
        const googleContext = await this.fetchGoogleContext(intent)
        if (googleContext) {
          hasGoogleData = true
          messages.splice(messages.length - 1, 0, {
            role: 'system',
            content: `DONNÉES EN TEMPS RÉEL ci-dessous — présente-les à l'utilisateur de façon structurée, complète et lisible. Type d'action = "none" obligatoire. N'invente rien au-delà de ces données.\n\n${googleContext}`
          })
        }
      }

      const response = await this.aiRouter!.complete(text, {
        messages,
        maxTokens: hasGoogleData ? 2000 : 512,
        temperature: 0.4
      });
      const davitus = parseDavitusResponse(response.content);

      this._pendingJobId = null;
      let actionConfirm = "";
      if (davitus.action.type !== "none") {
        actionConfirm = await this.executeAction(davitus.action, chatId, text);
      }

      const finalReply = actionConfirm ? `${davitus.reply}\n\n${actionConfirm}` : davitus.reply;
      this.conversations.add(chatId, "assistant", davitus.reply);
      await ctx.reply(this.renderAssistantReply(finalReply, text, mode));

      if (this._pendingJobId) {
        this.watchJob(this._pendingJobId, chatId, ctx);
        this._pendingJobId = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      console.error("[Davitus] Erreur conversationnelle:", message);
      await ctx.reply("Je n'ai pas pu traiter ta demande. Reessaie dans un instant.");
    }
  }

  private async executeAction(
    action: import('./DavitusPrompt').DavitusAction,
    chatId: string,
    originalText: string
  ): Promise<string> {
    try {
      if (action.type === "task" && this.taskRepository) {
        const projectId = action.projectId ?? this.conversations.getCurrentProject(chatId)?.id;
        await this.taskRepository.create({
          title: action.title ?? originalText,
          ...(projectId ? { projectId } : {}),
          notes: originalText
        });
        return projectId
          ? `Tache creee dans "${this.conversations.getCurrentProject(chatId)?.title ?? projectId}".`
          : "Tache creee.";
      }

      if (action.type === "project") {
        const inboxItem = await this.captureInboxItem.execute({
          source: "telegram",
          content: action.title ?? originalText,
          userId: chatId
        });
        const result = await this.processInboxItem.execute(inboxItem.id);
        if (this.notifier) {
          await this.notifier.notifyInboxProcessed(result).catch(() => undefined);
        }
        return result.projectId ? "Projet cree." : "Projet capture dans l'inbox.";
      }

      if (action.type === "note") {
        await this.captureInboxItem.execute({
          source: "telegram",
          content: action.content ?? originalText,
          userId: chatId
        });
        return "Note enregistree.";
      }

      if (action.type === "calendar_event" && this.calendarService) {
        if (!action.title || !action.datetime) {
          return "Je n'ai pas pu déterminer la date ou le titre de l'événement."
        }
        const start = new Date(action.datetime)
        if (isNaN(start.getTime())) {
          return "Date invalide — reformule avec une heure précise."
        }
        const durationMs = (action.duration ?? 60) * 60 * 1000
        const end = new Date(start.getTime() + durationMs)
        const event = await this.calendarService.createEvent({
          title: action.title,
          start,
          end,
          ...(action.location ? { location: action.location } : {}),
        })
        const dateStr = event.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        const timeStr = event.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        return `Événement créé : *${event.title}* — ${dateStr} à ${timeStr}${action.location ? ` (${action.location})` : ''}`
      }

      if (action.type === "escalate" && this.managerService) {
        const result = await this.managerService.handle({
          chatId,
          request: action.content ?? originalText,
          currentProject: this.conversations.getCurrentProject(chatId)
        });
        if (result.jobId) {
          this._pendingJobId = result.jobId;
        }
        return result.reply;
      }
    } catch (error) {
      console.error("[Davitus] Erreur action:", error);
    }

    return "";
  }

  private _pendingJobId: string | null = null;

  private async handleGtdOnly(
    ctx: ReplyContext,
    chatId: string,
    text: string,
    mode: "text" | "voice" = "text"
  ): Promise<void> {
    try {
      const inboxItem = await this.captureInboxItem.execute({
        source: "telegram",
        content: text,
        userId: chatId
      });

      if (!this.options.autoProcess) {
        await ctx.reply("Capture dans l'inbox.");
        return;
      }

      const result = await this.processInboxItem.execute(inboxItem.id);
      if (this.notifier) {
        await this.notifier.notifyInboxProcessed(result).catch(() => undefined);
      }
      await ctx.reply(this.renderAssistantReply(this.renderGtdResult(result), text, mode));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await ctx.reply(`Erreur Fusion: ${message}`);
    }
  }

  private async processIncomingText(
    ctx: ReplyContext,
    chatId: string,
    text: string,
    mode: "text" | "voice" = "text"
  ): Promise<void> {
    if (this.aiRouter) {
      await this.handleConversational(ctx, chatId, text, mode);
    } else {
      await this.handleGtdOnly(ctx, chatId, text, mode);
    }
  }

  private async handleVoiceLikeMessage(
    ctx: ReplyContext,
    chatId: string,
    input: { fileId: string; fileName: string; mimeType?: string }
  ): Promise<void> {
    if (!this.speechToText) {
      await ctx.reply(
        "J'ai bien recu ton vocal, mais la transcription n'est pas encore configuree sur Fusion. Ajoute OPENAI_API_KEY pour activer cette fonction."
      );
      return;
    }

    try {
      const transcript = await this.transcribeTelegramFile(input);
      await this.processIncomingText(ctx, chatId, transcript, "voice");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      console.error("[Davitus] Erreur transcription vocale:", message);
      await ctx.reply(`Je n'ai pas reussi a transcrire ton vocal: ${message}`);
    }
  }

  private async transcribeTelegramFile(input: { fileId: string; fileName: string; mimeType?: string }): Promise<string> {
    if (!this.bot || !this.speechToText) {
      throw new Error("Service vocal indisponible.");
    }

    const fileUrl = await this.bot.telegram.getFileLink(input.fileId);
    const response = await fetch(fileUrl.toString());

    if (!response.ok) {
      throw new Error(`Telechargement Telegram impossible (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return this.speechToText.transcribe({
      audio: Buffer.from(arrayBuffer),
      filename: input.fileName,
      ...(input.mimeType ? { mimeType: input.mimeType } : {})
    });
  }

  private renderGtdResult(result: {
    classification: { bucket: string; reason: string; confidence: number };
    projectId?: string | null;
    taskId?: string | null;
  }): string {
    const icons: Record<string, string> = {
      task: "OK",
      project: "PROJET",
      incubator: "IDEE",
      archive: "ARCHIVE",
      trash: "SUPPRIME"
    };
    const icon = icons[result.classification.bucket] ?? "NOTE";
    const lines = [`${icon} ${result.classification.bucket} - ${result.classification.reason}`];
    if (result.projectId) lines.push(`Projet : ${result.projectId}`);
    if (result.taskId) lines.push(`Tache : ${result.taskId}`);
    return lines.join("\n");
  }

  private renderAssistantReply(reply: string, text: string, mode: "text" | "voice"): string {
    if (mode === "text") {
      return reply;
    }

    return ["Transcription", text, "", reply].join("\n");
  }

  private async renderProjectStatus(chatId: string): Promise<string> {
    const currentProject = this.conversations.getCurrentProject(chatId);
    const activeProjects = (await this.projectRepository?.listActive?.()) ?? [];

    const lines = [
      currentProject
        ? `Projet courant : ${currentProject.title} (${currentProject.id})`
        : "Projet courant : aucun"
    ];

    if (activeProjects.length > 0) {
      lines.push("", "Projets actifs :");
      lines.push(...activeProjects.slice(0, 10).map((project) => `- ${project.title} (${project.id})`));
      lines.push("", "Utilise /project NomDuProjet pour basculer.");
    }

    return lines.join("\n");
  }

  private async tryHandleProjectSwitch(chatId: string, text: string): Promise<string | null> {
    const match = text.match(/^(?:bascule(?:r)?|switch|passe(?:r)?|on passe)\s+(?:sur|au|dans)\s+(?:le\s+)?projet\s+(.+)$/i);
    if (!match) {
      return null;
    }

    return this.switchConversationProject(chatId, match[1]!.trim());
  }

  private async switchConversationProject(chatId: string, query: string): Promise<string> {
    const projects = (await this.projectRepository?.listActive?.()) ?? [];
    const target = this.findProject(projects, query);

    if (!target) {
      const suggestions = projects.slice(0, 10).map((project) => `- ${project.title}`).join("\n");
      return suggestions
        ? `Je n'ai pas trouve ce projet.\n\nProjets actifs :\n${suggestions}`
        : "Je n'ai pas trouve ce projet et aucun projet actif n'est disponible.";
    }

    this.conversations.setCurrentProject(chatId, {
      id: target.id,
      title: target.title
    });

    return `Projet courant defini : ${target.title}\nLes prochains echanges resteront dans ce contexte jusqu'au prochain changement explicite ou jusqu'au prochain jour.`;
  }

  private findProject(projects: Project[], query: string): Project | undefined {
    const normalized = query.trim().toLowerCase();
    return projects.find((project) => project.id.toLowerCase() === normalized)
      ?? projects.find((project) => project.title.trim().toLowerCase() === normalized)
      ?? projects.find((project) => project.title.toLowerCase().includes(normalized));
  }

  private isAdmin(chatId: string): boolean {
    return this.options.adminChatIds.has(chatId);
  }

  private async ensureAdminRegistered(chatId: string, name: string): Promise<void> {
    const existing = await this.userRepository?.findByChatId(chatId);
    if (!existing) {
      await this.userRepository?.add(chatId, name, chatId, "admin");
    }
  }

  private async ensureAuthorizedChat(ctx: { chat: { id: number }; reply: (message: string) => Promise<unknown> }): Promise<boolean> {
    const chatId = String(ctx.chat.id);
    if (this.isAdmin(chatId)) {
      return true;
    }

    const authorized = await this.userRepository?.isAuthorized(chatId) ?? false;
    if (!authorized) {
      await ctx.reply(`Acces non autorise. Ton Chat ID : ${chatId}`);
      return false;
    }

    return true;
  }
}
