import type { GmailMessage } from '../google/GmailService'
import type { LlmAdapter } from '../ai-router/types'
import type { DeveloperControlService } from '../dev-agent/DeveloperControlService'
import { DAITIVUS_ETHICS_CHARTER, DAITIVUS_ETHICS_SHORT } from '../../persona/daitivusEthics'

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
  gpt: LlmAdapter
  qwenCoder?: LlmAdapter
  geminiFlash?: LlmAdapter
  geminiPro?: LlmAdapter
  claude?: LlmAdapter
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

const MANAGER_SYSTEM_PROMPT = `Tu es l'IA MANAGER de Fusion - l'orchestrateur central.

Tu recois des demandes escaladees par Davitus. Tu analyses, decides l'execut eur optimal, formules la tache.

${DAITIVUS_ETHICS_CHARTER}

EQUIPE DISPONIBLE :
- "codex"        : execution de code dans le repo Git (creer/modifier fichiers, tests, bug fix, deploiement)
- "qwen-coder"   : generation de code, refactoring, revue technique, architecture code (sans execution)
- "gemini-flash" : veille, synthese de flux, resumes rapides, classification de documents en masse
- "gemini-pro"   : recherche approfondie, rapports longs multi-sources, raisonnement complexe, analyse strategique
- "claude"       : uniquement si criticite maximale et aucun autre modele ne peut faire le travail - tres couteux
- "direct"       : tu reponds toi-meme (questions, explications courtes, decisions simples)

REGLE DE COUT : direct > gemini-flash > qwen-coder ~= gemini-pro > codex > claude
Choisis toujours le modele le moins cher capable de faire le travail.
REGLE DE GARDE-FOU : si une demande va contre la richesse durable, la sante ou la stabilite mentale de l'utilisateur, tu ralentis, recadres et proposes une voie plus saine.

REPONSE - JSON strict :
{
  "acknowledgment": "message bref et factuel pour l'utilisateur",
  "executor": "codex|qwen-coder|gemini-flash|gemini-pro|claude|direct",
  "task": "description precise et complete pour l'execut eur (vide si direct)"
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
    const managerResponse = await this.adapters.gpt.complete({
      messages: [
        { role: 'system', content: MANAGER_SYSTEM_PROMPT },
        { role: 'user', content: input.request }
      ],
      maxTokens: 512,
      temperature: 0.2
    })

    const decision = parseDecision(managerResponse.content)

    if (decision.executor === 'direct' || !decision.task) {
      return { reply: decision.acknowledgment }
    }

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

    if (decision.executor === 'qwen-coder') {
      const adapter = this.adapters.qwenCoder ?? this.adapters.gpt
      const response = await adapter.complete({
        messages: [
          { role: 'system', content: `${DAITIVUS_ETHICS_SHORT}\nTu es un expert en developpement logiciel. Genere du code propre, documente et teste.` },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 4096,
        temperature: 0.2
      })
      return { reply: response.content }
    }

    if (decision.executor === 'gemini-flash') {
      const adapter = this.adapters.geminiFlash ?? this.adapters.gpt
      const response = await adapter.complete({
        messages: [
          { role: 'system', content: `${DAITIVUS_ETHICS_SHORT}\nTu es un expert en veille et synthese d'information. Sois concis et structure.` },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 2048,
        temperature: 0.3
      })
      return { reply: response.content }
    }

    if (decision.executor === 'gemini-pro') {
      const adapter = this.adapters.geminiPro ?? this.adapters.geminiFlash ?? this.adapters.gpt
      const response = await adapter.complete({
        messages: [
          { role: 'system', content: `${DAITIVUS_ETHICS_SHORT}\nTu es un expert en recherche et analyse. Produis une reponse complete, sourcee et structuree.` },
          { role: 'user', content: decision.task }
        ],
        maxTokens: 8192,
        temperature: 0.3
      })
      return { reply: response.content }
    }

    if (decision.executor === 'claude' && this.adapters.claude) {
      const available = await this.adapters.claude.isAvailable()
      if (available) {
        const response = await this.adapters.claude.complete({
          messages: [
            { role: 'system', content: `${DAITIVUS_ETHICS_SHORT}\nTu es un expert de haut niveau. Reponds avec precision et profondeur maximale.` },
            { role: 'user', content: decision.task }
          ],
          maxTokens: 4096,
          temperature: 0.3
        })
        return { reply: response.content }
      }
    }

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
      ? projects.map((project) => `  - [${project.id}] ${project.title}`).join('\n')
      : '  Aucun projet actif.'

    const emailList = emails.map((message, index) => [
      `Email ${index + 1} (id: ${message.id})`,
      `  De: ${message.from}`,
      `  Objet: ${message.subject}`,
      `  Extrait: ${message.snippet.slice(0, 200)}`
    ].join('\n')).join('\n\n')

    const prompt = `Tu es le Manager IA. Tu traites la boite email d'un entrepreneur.

${DAITIVUS_ETHICS_CHARTER}

REGLE DE TRIAGE :
- "task" : email qui demande une action reelle (repondre a un partenaire, valider une livraison, decision a prendre, paiement, contrat, opportunite business)
- "ignore" : newsletter, promo commerciale, notification automatique, email sans action requise
- Priorite haute si l'email touche au revenu, a un risque financier, a la sante ou a une urgence reelle.

PROJETS ACTIFS (pour assigner les taches) :
${projectList}

EMAILS A TRAITER :
${emailList}

Reponds UNIQUEMENT en JSON valide :
{
  "decisions": [
    {
      "emailId": "id exact de l'email",
      "action": "task|ignore",
      "taskTitle": "titre court et actionnable (si action=task)",
      "projectId": "id du projet ou null",
      "priority": "high|normal|low",
      "reason": "1 phrase - pourquoi cette decision"
    }
  ],
  "summary": "resume en 1 phrase de ce que tu as traite"
}`

    const raw = await this.adapters.gpt.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      temperature: 0.1
    })

    const parsed = this.parseInboxDecisions(raw.content)
    const tasksCreated = parsed.decisions.filter((decision) => decision.action === 'task').length
    const ignored = parsed.decisions.filter((decision) => decision.action === 'ignore').length

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
