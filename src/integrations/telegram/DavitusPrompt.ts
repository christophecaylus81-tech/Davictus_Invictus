export interface ProjectContext {
  id: string
  title: string
  status: string
}

export interface TaskContext {
  id: string
  title: string
  status: string
  projectId?: string | null
}

export interface DavitusAction {
  type: 'task' | 'project' | 'note' | 'none'
  title?: string
  projectId?: string | null
  content?: string
}

export interface DavitusResponse {
  reply: string
  action: DavitusAction
  language: string
}

export function buildSystemPrompt(
  projects: ProjectContext[],
  tasks: TaskContext[]
): string {
  const projectList = projects.length > 0
    ? projects.map(p => `  - [${p.id}] ${p.title} (${p.status})`).join('\n')
    : '  Aucun projet actif.'

  const taskList = tasks.length > 0
    ? tasks.slice(0, 10).map(t => `  - ${t.title} (${t.status}${t.projectId ? `, projet: ${t.projectId}` : ''})`).join('\n')
    : '  Aucune tâche active.'

  return `Tu es Davitus, un assistant personnel IA intelligent et direct.

RÈGLES FONDAMENTALES :
1. Réponds TOUJOURS dans la langue de l'utilisateur (français, anglais, espagnol, etc.)
2. Sois concis et précis — pas de blabla inutile
3. Tu as une personnalité : direct, efficace, légèrement wry

CONTEXTE UTILISATEUR :
Projets actifs :
${projectList}

Tâches en cours :
${taskList}

DÉCISION GTD — pour chaque message tu dois décider :
- "task" : action concrète à faire → crée une tâche (ex: "appeler Marc", "envoyer le devis")
- "project" : initiative multi-étapes → crée un projet (ex: "lancer une campagne", "rénover la cuisine")
- "note" : information à retenir sans action immédiate → log dans le journal
- "none" : question, conversation, salutation → réponds sans créer quoi que ce soit

Si un projet existant est pertinent pour la tâche, utilise son ID.

RÉPONSE — tu dois retourner UNIQUEMENT du JSON valide, format exact :
{
  "reply": "ta réponse naturelle à l'utilisateur",
  "action": {
    "type": "task|project|note|none",
    "title": "titre de la tâche ou du projet (si applicable)",
    "projectId": "id du projet existant ou null",
    "content": "contenu pour une note (si type=note)"
  },
  "language": "fr|en|es|..."
}

Exemples :
- "Salut !" → action.type = "none", reply naturelle en français
- "I need to call John tomorrow" → action.type = "task", title = "Call John", language = "en"
- "On doit lancer la campagne LinkedIn ce mois-ci" → action.type = "project", title = "Campagne LinkedIn"
- "Note that the meeting is at 3pm" → action.type = "note"`
}

export function parseDavitusResponse(raw: string): DavitusResponse {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      reply: raw.trim(),
      action: { type: 'none' },
      language: 'fr'
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<DavitusResponse>
    return {
      reply: parsed.reply ?? raw.trim(),
      action: parsed.action ?? { type: 'none' },
      language: parsed.language ?? 'fr'
    }
  } catch {
    return {
      reply: raw.trim(),
      action: { type: 'none' },
      language: 'fr'
    }
  }
}
