import { Telegraf } from 'telegraf'
import type { AiRouter } from '../ai-router/AiRouter'
import type { ProjectRepository } from '../../domain/projects/repositories'
import type { TaskRepository } from '../../domain/tasks/repositories'
import type { CaptureInboxItemUseCase } from '../../domain/inbox/usecases/CaptureInboxItemUseCase'
import type { ProcessInboxItemUseCase } from '../../domain/inbox/usecases/ProcessInboxItemUseCase'
import type { ProcessingEventNotifier } from '../n8n/N8nAdapter'
import { ConversationManager } from './ConversationManager'
import { buildSystemPrompt, parseDavitusResponse } from './DavitusPrompt'

interface TelegramBotOptions {
  token: string | undefined
  allowedChatIds: Set<string>
  autoProcess: boolean
}

export class TelegramBotService {
  private bot: Telegraf | null = null
  private readonly conversations = new ConversationManager()

  constructor(
    private readonly options: TelegramBotOptions,
    private readonly captureInboxItem: CaptureInboxItemUseCase,
    private readonly processInboxItem: ProcessInboxItemUseCase,
    private readonly notifier?: ProcessingEventNotifier,
    private readonly aiRouter?: AiRouter,
    private readonly projectRepository?: ProjectRepository,
    private readonly taskRepository?: TaskRepository
  ) {}

  async start(): Promise<void> {
    if (!this.options.token) {
      console.log('Telegram bot inactif: TELEGRAM_BOT_TOKEN non configuré.')
      return
    }

    this.bot = new Telegraf(this.options.token)

    this.bot.start(async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return
      await ctx.reply(
        'Davitus en ligne.\n\nEnvoie-moi un message — je capte, classe et réponds.\nCommande : /clear pour réinitialiser la conversation.'
      )
    })

    this.bot.command('id', async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return
      await ctx.reply(`Chat ID : ${ctx.chat.id}`)
    })

    this.bot.command('clear', async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return
      this.conversations.clear(String(ctx.chat.id))
      await ctx.reply('Conversation réinitialisée.')
    })

    this.bot.on('text', async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return

      const text = ctx.message.text?.trim()
      if (!text || text.startsWith('/')) return

      const chatId = String(ctx.chat.id)

      // Mode conversationnel si aiRouter disponible
      if (this.aiRouter) {
        await this.handleConversational(ctx, chatId, text)
      } else {
        await this.handleGtdOnly(ctx, chatId, text)
      }
    })

    await this.bot.launch()
    console.log('Telegram bot lancé (mode conversationnel).')
  }

  async stop(): Promise<void> {
    if (!this.bot) return
    this.bot.stop('shutdown')
    this.bot = null
  }

  // ── Mode conversationnel ─────────────────────────────────────────────────

  private async handleConversational(
    ctx: { reply: (msg: string) => Promise<unknown> },
    chatId: string,
    text: string
  ): Promise<void> {
    try {
      // 1. Récupérer contexte projets + tâches
      const [projects, tasks] = await Promise.all([
        this.projectRepository?.listActive?.() ?? [],
        this.taskRepository?.listActive?.() ?? []
      ])

      // 2. Construire historique
      this.conversations.add(chatId, 'user', text)
      const history = this.conversations.get(chatId)

      // 3. Appel IA
      const systemPrompt = buildSystemPrompt(projects, tasks)
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ]

      const response = await this.aiRouter!.complete(text, { messages, maxTokens: 512, temperature: 0.4 })
      const davitus = parseDavitusResponse(response.content)

      // 4. Exécuter l'action GTD si nécessaire
      let actionConfirm = ''
      if (davitus.action.type !== 'none') {
        actionConfirm = await this.executeAction(davitus.action, chatId, text)
      }

      // 5. Construire la réponse finale
      const finalReply = actionConfirm
        ? `${davitus.reply}\n\n${actionConfirm}`
        : davitus.reply

      // 6. Sauvegarder dans l'historique
      this.conversations.add(chatId, 'assistant', davitus.reply)

      await ctx.reply(finalReply)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[Davitus] Erreur conversationnelle:', msg)
      // Fallback GTD
      await this.handleGtdOnly(ctx, chatId, text)
    }
  }

  private async executeAction(
    action: { type: string; title?: string; projectId?: string | null; content?: string },
    chatId: string,
    originalText: string
  ): Promise<string> {
    try {
      if (action.type === 'task' || action.type === 'project') {
        const inboxItem = await this.captureInboxItem.execute({
          source: 'telegram',
          content: action.title ?? originalText,
          userId: chatId,
        })
        const result = await this.processInboxItem.execute(inboxItem.id)
        if (this.notifier) {
          await this.notifier.notifyInboxProcessed(result).catch(() => undefined)
        }
        if (action.type === 'task' && result.taskId) {
          return `✅ Tâche créée`
        }
        if (action.type === 'project' && result.projectId) {
          return `📁 Projet créé`
        }
      }

      if (action.type === 'note' && action.content) {
        await this.captureInboxItem.execute({
          source: 'telegram',
          content: action.content,
          userId: chatId,
        })
        return `📝 Note enregistrée`
      }
    } catch (err) {
      console.error('[Davitus] Erreur action GTD:', err)
    }
    return ''
  }

  // ── Fallback GTD simple ──────────────────────────────────────────────────

  private async handleGtdOnly(
    ctx: { reply: (msg: string) => Promise<unknown> },
    chatId: string,
    text: string
  ): Promise<void> {
    try {
      const inboxItem = await this.captureInboxItem.execute({
        source: 'telegram',
        content: text,
        userId: chatId,
      })

      if (!this.options.autoProcess) {
        await ctx.reply(`Capturé dans l'inbox.`)
        return
      }

      const result = await this.processInboxItem.execute(inboxItem.id)
      if (this.notifier) {
        await this.notifier.notifyInboxProcessed(result).catch(() => undefined)
      }
      await ctx.reply(this.renderGtdResult(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      await ctx.reply(`Erreur Fusion: ${message}`)
    }
  }

  private renderGtdResult(result: {
    classification: { bucket: string; reason: string; confidence: number }
    projectId?: string | null
    taskId?: string | null
  }): string {
    const icons: Record<string, string> = {
      task: '✅', project: '📁', incubator: '💡', archive: '🗄️', trash: '🗑️'
    }
    const icon = icons[result.classification.bucket] ?? '📌'
    const lines = [`${icon} ${result.classification.bucket} — ${result.classification.reason}`]
    if (result.projectId) lines.push(`Projet : ${result.projectId}`)
    if (result.taskId) lines.push(`Tâche : ${result.taskId}`)
    return lines.join('\n')
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async ensureAuthorizedChat(ctx: {
    chat: { id: number }
    reply: (msg: string) => Promise<unknown>
  }): Promise<boolean> {
    const chatId = String(ctx.chat.id)
    if (this.options.allowedChatIds.size > 0 && !this.options.allowedChatIds.has(chatId)) {
      await ctx.reply('Accès non autorisé.')
      return false
    }
    return true
  }
}
