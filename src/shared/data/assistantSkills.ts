import type { AssistantEffort, AssistantModel } from '../types/assistant'

/**
 * Assistant skills: one per kind of task, each with the cheapest model and
 * effort that does it well, short task instructions and the expected output
 * shape (short answers = fewer output tokens). In "auto" mode the skill picks
 * the model; the user can force one in Settings.
 */
export type AssistantSkillId =
  | 'chat' | 'web-search' | 'explain-error' | 'commit-message' | 'review-changes'
  | 'explain-project' | 'write-sql' | 'debug-container' | 'analyze-response'

type Text = { fr: string; en: string }

export interface AssistantSkill {
  id: AssistantSkillId
  /** lucide icon name, mapped in the renderer */
  icon: string
  label: Text
  description: Text
  model: AssistantModel
  effort: AssistantEffort
  /** Appended to the system prompt for this conversation */
  instructions: Text
  /** Sent at once when the skill is picked; absent = the user writes the question */
  prompt?: Text
  /** What the skill needs to be useful */
  needs?: 'project' | 'page'
  /** Can search the web (Sonnet and Opus only; $0.01 per search) */
  web?: boolean
}

/** Price of one web search (USD) */
export const WEB_SEARCH_PRICE = 0.01

export const ASSISTANT_SKILLS: AssistantSkill[] = [
  {
    id: 'chat', icon: 'MessageSquare',
    label: { fr: 'Question libre', en: 'Free question' },
    description: { fr: 'Tout le reste', en: 'Anything else' },
    model: 'claude-sonnet-5-5', effort: 'low', web: true,
    instructions: { fr: 'Réponds à la question posée, rien de plus.', en: 'Answer the question asked, nothing more.' }
  },
  {
    id: 'web-search', icon: 'Search',
    label: { fr: 'Recherche web', en: 'Web search' },
    description: { fr: 'Actualité, questions du quotidien', en: 'News, everyday questions' },
    model: 'claude-sonnet-5-5', effort: 'low', web: true,
    instructions: {
      fr: "Tâche : question générale ou d'actualité. Cherche sur le web si la réponse dépend d'informations récentes ou que tu n'as pas (2 recherches au plus). Réponse courte et datée si utile. Les sources sont ajoutées automatiquement : ne les liste pas.",
      en: 'Task: general or current-events question. Search the web when the answer depends on recent information or facts you lack (2 searches at most). Short answer, dated when useful. Sources are added automatically: do not list them.'
    }
  },
  {
    id: 'explain-error', icon: 'Bug',
    label: { fr: 'Expliquer une erreur', en: 'Explain an error' },
    description: { fr: 'Cause probable et correction', en: 'Likely cause and fix' },
    model: 'claude-haiku-5-5', effort: 'low',
    instructions: {
      fr: "Tâche : expliquer une erreur. Format : **Cause** (1-2 phrases), **Correction** (étapes ou code minimal), **Pour vérifier** (1 ligne). Lis un fichier seulement si l'erreur cite un chemin précis.",
      en: 'Task: explain an error. Format: **Cause** (1-2 sentences), **Fix** (steps or minimal code), **To check** (1 line). Read a file only when the error names a precise path.'
    }
  },
  {
    id: 'commit-message', icon: 'GitCommitHorizontal',
    label: { fr: 'Message de commit', en: 'Commit message' },
    description: { fr: 'Depuis les changements en cours', en: 'From the current changes' },
    model: 'claude-haiku-5-5', effort: 'low', needs: 'project',
    instructions: {
      fr: "Tâche : message de commit. Appelle git_diff une fois (staged=true, puis sans si vide). Réponds uniquement par un bloc de code contenant le message au format Conventional Commits : `type(zone): sujet` en anglais, ligne vide, puis 1 à 4 puces si utile. Rien d'autre.",
      en: 'Task: commit message. Call git_diff once (staged=true, then without if empty). Answer only with a code block holding a Conventional Commits message: `type(scope): subject`, blank line, then 1 to 4 bullets if useful. Nothing else.'
    },
    prompt: { fr: 'Écris le message de commit de mes changements.', en: 'Write the commit message for my changes.' }
  },
  {
    id: 'review-changes', icon: 'ShieldCheck',
    label: { fr: 'Revue des changements', en: 'Review changes' },
    description: { fr: 'Bugs et risques avant de commiter', en: 'Bugs and risks before committing' },
    model: 'claude-sonnet-5-5', effort: 'medium', needs: 'project',
    instructions: {
      fr: "Tâche : revue de code des changements non commités (git_diff). Ne signale que les vrais problèmes : bugs, failles, cas oubliés. Liste triée par gravité, au plus 8 points : `fichier:ligne` — problème — correction. Si rien d'important : dis-le en une phrase.",
      en: 'Task: code review of uncommitted changes (git_diff). Report only real problems: bugs, security issues, missed cases. List sorted by severity, at most 8 items: `file:line` — problem — fix. If nothing important: say so in one sentence.'
    },
    prompt: { fr: 'Fais la revue de mes changements non commités.', en: 'Review my uncommitted changes.' }
  },
  {
    id: 'explain-project', icon: 'BookOpen',
    label: { fr: 'Expliquer le projet', en: 'Explain the project' },
    description: { fr: 'Stack, structure, démarrage', en: 'Stack, structure, getting started' },
    model: 'claude-haiku-5-5', effort: 'low', needs: 'project',
    instructions: {
      fr: "Tâche : présenter le projet. Pars du contexte fourni, ouvre au plus 3 fichiers clés. Format : **But** (1 phrase), **Stack**, **Structure** (dossiers importants), **Lancer en local** (commandes). Moins de 200 mots.",
      en: 'Task: present the project. Start from the given context, open at most 3 key files. Format: **Purpose** (1 sentence), **Stack**, **Structure** (main folders), **Run locally** (commands). Under 200 words.'
    },
    prompt: { fr: 'Explique-moi ce projet.', en: 'Explain this project to me.' }
  },
  {
    id: 'write-sql', icon: 'Database',
    label: { fr: 'Écrire du SQL', en: 'Write SQL' },
    description: { fr: "D'après la structure de ta base", en: 'From your database structure' },
    model: 'claude-sonnet-5-5', effort: 'low',
    instructions: {
      fr: "Tâche : écrire du SQL. Utilise la structure fournie ou appelle db_schema une fois. Réponds par un bloc ```sql``` puis une phrase d'explication. Préfère SELECT ; pour UPDATE/DELETE, mets toujours un WHERE et préviens.",
      en: 'Task: write SQL. Use the given structure or call db_schema once. Answer with a ```sql``` block then one sentence of explanation. Prefer SELECT; for UPDATE/DELETE always use a WHERE and warn.'
    }
  },
  {
    id: 'debug-container', icon: 'Container',
    label: { fr: 'Diagnostiquer un conteneur', en: 'Debug a container' },
    description: { fr: "D'après ses logs", en: 'From its logs' },
    model: 'claude-haiku-5-5', effort: 'low',
    instructions: {
      fr: 'Tâche : diagnostiquer un conteneur Docker. docker_status puis container_logs (60 lignes) sur le conteneur en cause. Format : **Problème**, **Cause**, **Correction** (commande ou fichier à changer).',
      en: 'Task: debug a Docker container. docker_status then container_logs (60 lines) on the faulty one. Format: **Problem**, **Cause**, **Fix** (command or file to change).'
    }
  },
  {
    id: 'analyze-response', icon: 'Globe',
    label: { fr: 'Analyser la réponse API', en: 'Analyze the API response' },
    description: { fr: "Celle de l'API Tester", en: 'From the API tester' },
    model: 'claude-haiku-5-5', effort: 'low', needs: 'page',
    instructions: {
      fr: "Tâche : analyser la requête et la réponse HTTP jointes, sans outil. Format : **Statut** (ce qu'il signifie), **Contenu** (structure et points notables), **À corriger** si erreur.",
      en: 'Task: analyze the attached HTTP request and response, without tools. Format: **Status** (what it means), **Content** (structure and notable points), **To fix** if an error.'
    },
    prompt: { fr: 'Analyse cette réponse.', en: 'Analyze this response.' }
  }
]

export const skillById = (id: string | undefined | null): AssistantSkill =>
  ASSISTANT_SKILLS.find(s => s.id === id) ?? ASSISTANT_SKILLS[0]

// ─── Pricing (USD per million tokens), for the cost estimate shown to the user ─

export interface ModelPrice { input: number; output: number; cacheRead: number; cacheWrite: number }

const PRICES: Record<AssistantModel, ModelPrice> = {
  'claude-opus-5-5':   { input: 4,    output: 20,   cacheRead: 0.20, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2,    output: 10,   cacheRead: 0.20, cacheWrite: 2.5 },
  'claude-haiku-5-5':  { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 }
}
/** Haiku 5.5 bills prompts over 100K tokens at a higher rate */
const HAIKU_LONG: ModelPrice = { input: 0.50, output: 2.50, cacheRead: 0.05, cacheWrite: 0.625 }

export interface TokenUsage { input: number; output: number; cacheRead: number; cacheWrite: number }

export function costOf(model: string, u: TokenUsage): number {
  const base = PRICES[model as AssistantModel] ?? PRICES['claude-opus-5-5']
  const p = model === 'claude-haiku-5-5' && u.input + u.cacheRead + u.cacheWrite > 100_000 ? HAIKU_LONG : base
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000
}
