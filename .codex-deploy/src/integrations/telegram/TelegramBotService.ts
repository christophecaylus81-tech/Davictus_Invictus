import { Telegraf } from 'telegraf'
import type { AiRouter } from '../ai-router/AiRouter'
import type { ProjectRepository } from '../../domain/projects/repositories'
import type { TaskRepository } from '../../domain/tasks/repositories'
import type { CaptureInboxItemUseCase } from '../../domain/inbox/usecases/CaptureInboxItemUseCase'
import type { ProcessInboxItemUseCase } from '../../domain/inbox/usecases/ProcessInboxItemUseCase'
import type { ProcessingEventNotifier } from '../n8n/N8nAdapter'
import { ConversationManager } from './ConversationManager'
import { buildSystemPrompt, parseDavitusResponse } from './DavitusPrompt'
import type { SpeechToTextService } from '../voice/OpenAiSpeechToTextService'

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
    private readonly taskRepository?: TaskRepository,
    private readonly speechToText?: SpeechToTextService
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
        [
          'Davitus en ligne.',
          '',
          'Envoie-moi un message texte ou vocal — je capte, classe et réponds.',
          'Commande : /clear pour réinitialiser la conversation.'
        ].join('\n')
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
      await this.processIncomingText(ctx, chatId, text)
    })

    this.bot.on('voice', async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return

      const chatId = String(ctx.chat.id)
      const voice = ctx.message.voice
      await this.handleVoiceLikeMessage(ctx, chatId, {
        fileId: voice.file_id,
        fileName: `telegram-voice-${voice.file_unique_id}.ogg`,
        ...(voice.mime_type ? { mimeType: voice.mime_type } : {})
      })
    })

    this.bot.on('audio', async (ctx) => {
      if (!(await this.ensureAuthorizedChat(ctx))) return

      const chatId = String(ctx.chat.id)
      const audio = ctx.message.audio
      const fallbackExtension = audio.mime_type?.includes('mpeg') ? 'mp3' : 'm4a'
      await this.handleVoiceLikeMessage(ctx, chatId, {
        fileId: audio.file_id,
        fileName: audio.file_name ?? `telegram-audio-${audio.file_unique_id}.${fallbackExtension}`,
        ...(audio.mime_type ? { mimeType: audio.mime_type } : {})
      })
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
    text: string,
    mode: 'text' | 'voice' = 'text'
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

      await ctx.reply(this.renderAssistantReply(finalReply, text, mode))
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[Davitus] Erreur conversationnelle:', msg)
      // Fallback GTD
      await this.handleGtdOnly(ctx, chatId, text, mode)
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
    text: string,
    mode: 'text' | 'voice' = 'text'
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
      await ctx.reply(this.renderAssistantReply(this.renderGtdResult(result), text, mode))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      await ctx.reply(`Erreur Fusion: ${message}`)
    }
  }

  private async processIncomingText(
    ctx: { reply: (msg: string) => Promise<unknown> },
    chatId: string,
    text: string,
    mode: 'text' | 'voice' = 'text'
  ): Promise<void> {
    if (this.aiRouter) {
      await this.handleConversational(ctx, chatId, text, mode)
    } else {
      await this.handleGtdOnly(ctx, chatId, text, mode)
    }
  }

  private async handleVoiceLikeMessage(
    ctx: {
      reply: (msg: string) => Promise<unknown>
    },
    chatId: string,
    input: {
      fileId: string
      fileName: string
      mimeType?: string
    }
  ): Promise<void> {
    if (!this.speechToText) {
      await ctx.reply(
        "J'ai bien reçu ton vocal, mais la transcription n'est pas encore configurée sur Fusion. Ajoute OPENAI_API_KEY pour activer cette fonction."
      )
      return
    }

    try {
      const transcript = await this.transcribeTelegramFile(input)
      await this.processIncomingText(ctx, chatId, transcript, 'voice')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[Davitus] Erreur transcription vocale:', message)
      await ctx.reply(`Je n'ai pas réussi à transcrire ton vocal: ${message}`)
    }
  }

  private async transcribeTelegramFile(input: {
    fileId: string
    fileName: string
    mimeType?: string
  }): Promise<string> {
    if (!this.bot || !this.speechToText) {
      throw new Error('Service vocal indisponible.')
    }

    const fileUrl = await this.bot.telegram.getFileLink(input.fileId)
    const response = await fetch(fileUrl.toString())

    if (!response.ok) {
      throw new Error(`Téléchargement Telegram impossible (${response.status})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return this.speechToText.transcribe({
      audio: Buffer.from(arrayBuffer),
      filename: input.fileName,
      ...(input.mimeType ? { mimeType: input.mimeType } : {})
    })
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

  private renderAssistantReply(
    reply: string,
    text: string,
    mode: 'text' | 'voice'
  ): string {
    if (mode === 'text') {
      return reply
    }

    return [`🎙️ Transcription`, text, '', reply].join('\n')
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
