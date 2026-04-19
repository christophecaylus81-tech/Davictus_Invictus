import type { GmailMessage } from '../google/GmailService'
import type { LlmAdapter } from '../ai-router/types'
import type { DeveloperControlService } from '../dev-agent/DeveloperControlService'

// ── Traitement inbox email ────────────────────────────────────────────────────

export interface EmailDecision {
  emailId: string
  action: 'task' | 'ignore'
  taskTitle?: string
  projectId?: string | null
  priority?: 'high' | 'normal' | 'low'
  reason: string
}

export interface InboxProcessingResult {
  decisions: EmailDecision[]
  tasksCreated: number
  ignored: number
  summary: string
}

export interface ManagerAdapters {
  gpt: LlmAdapter          // Manager lui-même (GPT-4.1-mini)
  qwenCoder: LlmAdapter    // Code (Qwen-Coder)
  geminiFlash: LlmAdapter  // Veille & synthèse rapide
  geminiPro: LlmAdapter    // Rapports longs & recherche
  claude?: LlmAdapter      // Cas critiques uniquement
}

export interface ManagerInput {
  request: string
  chatId: string
  currentProject?: { id: string; title: string } | null
}

export interface ManagerResult {
  reply: string
  jobId?: string
}

type Executor = 'codex' | 'qwen-coder' | 'gemini-flash' | 'gemini-pro' | 'claude' | 'direct'

interface ManagerDecision {
  acknowledgment: string
  executor: Executor
  task: string
}

const MANAGER_SYSTEM_PROMPT = `Tu es l'IA MANAGER de Fusion — l'orchestrateur central. Tu tournes sur GPT.

Tu reçois des demandes escaladées par Davitus. Tu analyses, décides l'exécuteur optimal, formules la tâche.

ÉQUIPE DISPONIBLE :
- "codex"        : exécution de code dans le repo Git (créer/modifier fichiers, tests, bug fix, déploiement)
- "qwen-coder"   : génération de code, refactoring, revue technique, architecture code (sans exécution)
- "gemini-flash" : veille, synthèse de flux, résumés rapides, classification de documents en masse
- "gemini-pro"   : recherche approfondie, rapports longs multi-sources, raisonnement complexe, analyse stratégique
- "claude"       : UNIQUEMENT si criticité maximale et aucun autre modèle ne peut faire le travail — TRÈS COÛTEUX
- "direct"       : tu réponds toi-même (questions, explications courtes, décisions simples)

RÈGLE DE COÛT : direct > gemini-flash > qwen-coder ≈ gemini-pro > codex > claude
Choisis toujours le modèle le moins cher capable de faire le travail.

RÉPONSE — JSON strict :
{
  "acknowledgment": "message bref et factuel pour l'utilisateur",
  "executor": "codex|qwen-coder|gemini-flash|gemini-pro|claude|direct",
  "task": "description précise et complète pour l'exécuteur (vide si direct)"
}`

function parseDecision(raw: string): ManagerDecision {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { acknowledgment: raw.trim(), executor: 'direct', task: '' }
  try {
    const parsed = JSON.parse(match[0]) as Partial<ManagerDecision>
    return {
      acknowledgment: parsed.acknowledgment ?? raw.trim(),
      executor: (parsed.executor as Executor) ?? 'direct',
      task: parsed.task ?? ''
    }
  } catch {
    return { acknowledgment: raw.trim(), executor: 'direct', task: '' }
  }
}

export class ManagerService {
  constructor(
    private readonly adapters: ManagerAdapters,
    private readonly developerControl: DeveloperControlService
  ) {}

  async handle(input: ManagerInput): Promise<ManagerResult> {
    // Le Manager analyse la demande et décide
    const managerResponse = await this.adapters.gpt.complete({
      messages: [
        { role: 'system', content: MANAGER_SYSTEM_PROMPT },
        { role: 'user', content: input.request }
      ],
      maxTokens: 512,
      temperature: 0.2
    })

    const decision = parseDecision(managerResponse.content)

    // Réponse directe
    if (decision.executor === 'direct' || !decision.task) {
      return { reply: decision.acknowledgment }
    }

    // Exécution dans le repo Git via Codex worker
    if (decision.executor === 'codex') {
      const result = await this.developerControl.handleMessage({
        chatId: input.chatId,
        text: decision.task,
        currentProject: input.currentProject ?? null
      })
      return {
        reply: decision.acknowledgment,
        ...(result?.jobId ? { jobId: result.jobId } : {})
      }
    }

    // Génération de code sans exécution
    if (decision.executor === 'qwen-coder') {
      const response = await this.adapters.qwenCoder.complete({
        messages: [
          { role: 'system', content: 'Tu es un expert en développement logiciel. Génère du code propre, documenté et testé.' },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 4096,
        temperature: 0.2
      })
      return { reply: response.content }
    }

    // Veille & synthèse rapide
    if (decision.executor === 'gemini-flash') {
      const response = await this.adapters.geminiFlash.complete({
        messages: [
          { role: 'system', content: 'Tu es un expert en veille et synthèse d\'information. Sois concis et structuré.' },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 2048,
        temperature: 0.3
      })
      return { reply: response.content }
    }

    // Recherche approfondie & rapports longs
    if (decision.executor === 'gemini-pro') {
      const response = await this.adapters.geminiPro.complete({
        messages: [
          { role: 'system', content: 'Tu es un expert en recherche et analyse. Produis une réponse complète, sourcée et structurée.' },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 8192,
        temperature: 0.3
      })
      return { reply: response.content }
    }

    // Cas critique → Claude
    if (decision.executor === 'claude' && this.adapters.claude) {
      const available = await this.adapters.claude.isAvailable()
      if (available) {
        const response = await this.adapters.claude.complete({
          messages: [
            { role: 'system', content: 'Tu es un expert de haut niveau. Réponds avec précision et profondeur maximale.' },
            { role: 'user', content: decision.task }
          ],
          maxTokens: 4096,
          temperature: 0.3
        })
        return { reply: response.content }
      }
    }

    // Fallback ultime : GPT répond directement
    const fallback = await this.adapters.gpt.complete({
      messages: [{ role: 'user', content: decision.task }],
      maxTokens: 1024,
      temperature: 0.3
    })
    return { reply: fallback.content }
  }

  async processEmailInbox(
    emails: GmailMessage[],
    projects: { id: string; title: string }[]
  ): Promise<InboxProcessingResult> {
    if (emails.length === 0) {
      return { decisions: [], tasksCreated: 0, ignored: 0, summary: 'Inbox vide.' }
    }

    const projectList = projects.length > 0
      ? projects.map(p => `  - [${p.id}] ${p.title}`).join('\n')
      : '  Aucun projet actif.'

    const emailList = emails.map((m, i) => [
      `Email ${i + 1} (id: ${m.id})`,
      `  De: ${m.from}`,
      `  Objet: ${m.subject}`,
      `  Extrait: ${m.snippet.slice(0, 200)}`,
    ].join('\n')).join('\n\n')

    const prompt = `Tu es le Manager IA. Tu traites la boîte email d'un entrepreneur.

RÈGLE DE TRIAGE :
- "task" : email qui demande une action réelle (répondre à un partenaire, valider une livraison, décision à prendre, paiement, contrat, opportunité business)
- "ignore" : newsletter, promo commerciale, notification automatique, email sans action requise

PROJETS ACTIFS (pour assigner les tâches) :
${projectList}

EMAILS À TRAITER :
${emailList}

Réponds UNIQUEMENT en JSON valide :
{
  "decisions": [
    {
      "emailId": "id exact de l'email",
      "action": "task|ignore",
      "taskTitle": "titre court et actionnable (si action=task)",
      "projectId": "id du projet ou null",
      "priority": "high|normal|low",
      "reason": "1 phrase — pourquoi cette décision"
    }
  ],
  "summary": "résumé en 1 phrase de ce que tu as traité"
}`

    const raw = await this.adapters.gpt.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      temperature: 0.1
    })

    const parsed = this.parseInboxDecisions(raw.content)
    const tasksCreated = parsed.decisions.filter(d => d.action === 'task').length
    const ignored = parsed.decisions.filter(d => d.action === 'ignore').length

    return { ...parsed, tasksCreated, ignored }
  }

  private parseInboxDecisions(raw: string): Pick<InboxProcessingResult, 'decisions' | 'summary'> {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { decisions: [], summary: raw.trim() }
    try {
      const parsed = JSON.parse(match[0]) as { decisions?: EmailDecision[]; summary?: string }
      return {
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        summary: parsed.summary ?? ''
      }
    } catch {
      return { decisions: [], summary: raw.trim() }
    }
  }
}
