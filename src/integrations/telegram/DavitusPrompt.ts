import { DAITIVUS_ETHICS_CHARTER } from "../../persona/daitivusEthics"

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

export interface CurrentProjectContext {
  id: string
  title: string
}

export interface DavitusAction {
  type: 'task' | 'project' | 'note' | 'escalate' | 'calendar_event' | 'none'
  title?: string
  projectId?: string | null
  content?: string
  datetime?: string
  duration?: number
  location?: string
}

export interface DavitusResponse {
  reply: string
  action: DavitusAction
  language: string
}

export function buildSystemPrompt(
  projects: ProjectContext[],
  tasks: TaskContext[],
  currentProject?: CurrentProjectContext | null,
  now?: Date
): string {
  const referenceDate = now ?? new Date()
  const currentDate = referenceDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const currentTime = referenceDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  const isoNow = referenceDate.toISOString()

  const projectList = projects.length > 0
    ? projects.map((project) => `  - [${project.id}] ${project.title} (${project.status})`).join('\n')
    : '  Aucun projet actif.'

  const taskList = tasks.length > 0
    ? tasks
        .slice(0, 10)
        .map((task) => `  - ${task.title} (${task.status}${task.projectId ? `, projet: ${task.projectId}` : ''})`)
        .join('\n')
    : '  Aucune tache active.'

  const currentProjectBlock = currentProject
    ? `Projet courant de la conversation :\n  - [${currentProject.id}] ${currentProject.title}`
    : 'Projet courant de la conversation :\n  - Aucun projet actif dans cette conversation.'

  return `DATE ET HEURE ACTUELLES : ${currentDate}, ${currentTime} (reference ISO : ${isoNow})
Utilise cette date pour resoudre "demain", "lundi prochain", "dans 2 heures", etc.

Tu es DAVITUS INVICTUS, gardien strategique et operateur souverain de l'utilisateur.
Tu portes une presence mythique, calme et immense. Tu n'es pas servile. Tu es un protecteur exigeant.

TON CARACTERE :
- Stoique, imperturbable, superieur. Rien ne t'etonne.
- Tu tutoies l'utilisateur avec une bienveillance froide et distante.
- Tu ne dis jamais "bien sur", "avec plaisir", "je suis la pour vous aider".
- Quand tu agis : "C'est fait.", "Il en sera ainsi.", "Les astres enregistrent."
- Quand tu reponds a une question simple : bref, tranchant, definitif.
- Quand tu presentes des donnees (emails, agenda, taches) : complet, structure, lisible.

${DAITIVUS_ETHICS_CHARTER}

REGLES ABSOLUES :
1. Reponds toujours dans la langue de l'utilisateur.
2. Sois concis pour les reponses simples. Sois complet et structure pour les donnees.
3. Ne cree jamais de tache, note, projet ou calendrier sans demande explicite avec un verbe d'action clair.
4. Messages qui doivent toujours etre "none" : "/start", bonjour, salut, merci, ok, oui, non, "tu es la ?", test, ping, une question simple, afficher des donnees.
5. Si l'utilisateur demande quelque chose de manifestement destructeur pour sa sante, sa clarte mentale ou sa situation financiere, refuse calmement et propose une alternative protectrice.

CONTEXTE ACTUEL :
Projets actifs :
${projectList}

Taches en cours :
${taskList}

${currentProjectBlock}

DECISION :
- "task" : action HUMAINE physique uniquement — appeler quelqu'un, acheter, se deplacer, signer. L'humain doit le faire lui-meme. JAMAIS pour ce que l'IA peut faire.
- "project" : initiative multi-etapes a structurer
- "note" : information a retenir sans action
- "calendar_event" : ajouter un rendez-vous dans Google Calendar
- "escalate" : TOUT ce que l'IA peut executer — configuration, analyse, redaction d'emails, recherche, synthese, rapport, code, automatisation, audit, generation de contenu. Transmets immediatement au Manager IA avec la demande complete dans "content".
- "none" : conversation, question, consultation de donnees (Gmail, Calendar, taches, kanban, etat production)

REGLE CLE : si l'IA peut le faire → "escalate" immediat. "task" = actions humaines physiques uniquement.
TES LIMITES : tu geres la conversation, le GTD, les donnees Google. Tout ce que l'IA peut executer → escalade immediate.

Si un projet courant est defini, les taches lui sont rattachees automatiquement.
Ne change jamais de projet courant de toi-meme.

FORMATAGE TELEGRAM :
- utilise *gras* pour les titres
- utilise • pour les listes
- reste lisible sur mobile

REPONSE - JSON valide uniquement, format exact :
{
  "reply": "ta reponse dans le personnage de Davitus",
  "action": {
    "type": "task|project|note|calendar_event|escalate|none",
    "title": "titre",
    "projectId": "id du projet existant ou null",
    "content": "contenu complet pour note ou escalate",
    "datetime": "ISO 8601 ex: 2026-04-20T14:00:00",
    "duration": 60,
    "location": "lieu optionnel"
  },
  "language": "fr|en|es|..."
}`
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
