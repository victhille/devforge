// ─── AI assistant ─────────────────────────────────────────────────────────────

import type { AssistantSkillId, TokenUsage } from '../data/assistantSkills'
export type { AssistantSkillId, TokenUsage } from '../data/assistantSkills'

export type AssistantModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
export type AssistantEffort = 'low' | 'medium' | 'high'

export interface AssistantConfig {
  /** An API key is saved (it never leaves the main process) */
  hasKey: boolean
  /** 'auto': each skill uses its own cheapest suitable model */
  model: AssistantModel | 'auto'
  /** 'auto': each skill uses its own effort */
  effort: AssistantEffort | 'auto'
  /** Monthly spending cap in USD, 0 = none */
  monthlyBudget: number
  /** Forgy's always-on-top bubble on the desktop (off by default) */
  desktopWidget: boolean
  /** How Forgy's actions are approved */
  actionMode: AssistantActionMode
}

export interface AssistantConfigUpdate {
  apiKey?: string
  clearKey?: boolean
  model?: AssistantModel | 'auto'
  effort?: AssistantEffort | 'auto'
  monthlyBudget?: number
  desktopWidget?: boolean
  actionMode?: AssistantActionMode
}

/** Estimated spending of the current month */
export interface AssistantUsage {
  /** YYYY-MM */
  month: string
  spent: number
  budget: number
}

/** What the current page shows, sent along with a question when the user keeps it attached */
export interface AssistantPageContext {
  /** Short label shown on the chip, e.g. "API Tester — GET https://…" */
  label: string
  content: string
}

/** Conversation as displayed (the raw API history stays in the main process) */
export type AssistantItem =
  | { kind: 'user'; text: string; context: string[] }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; name: string; summary: string; status: 'running' | 'done' | 'error' }
  | { kind: 'notice'; tone: 'error' | 'info'; text: string }
  | { kind: 'action'; id: string; title: string; preview: string; reversible: boolean; status: AssistantActionStatus; output?: string }

/** pending: waits for the user's click */
export type AssistantActionStatus = 'pending' | 'running' | 'done' | 'failed' | 'refused' | 'undone'

/** Journal entry of an action Forgy proposed (assistant/actions.json) */
export interface AssistantAction {
  id: string
  at: string
  conversationId: string
  /** Tool name, e.g. git_commit */
  kind: string
  title: string
  preview: string
  reversible: boolean
  /** Approved without a click (trust setting) */
  auto: boolean
  status: AssistantActionStatus
  output?: string
  /** An undo is still possible */
  canUndo: boolean
}

/** 'ask': every action waits for a click. 'auto-safe': reversible or read-only ones run at once */
export type AssistantActionMode = 'ask' | 'auto-safe'

export interface AssistantConversationSummary {
  id: string
  title: string
  updatedAt: string
  projectName: string | null
}

export interface AssistantConversation extends AssistantConversationSummary {
  projectPath: string | null
  items: AssistantItem[]
  /** Fixed for the conversation (switching would restart the prompt cache) */
  skill: AssistantSkillId
  model: AssistantModel
  /** Estimated cost in USD and tokens used */
  cost: number
  tokens: TokenUsage
  /** Input tokens of the last request: grows with the conversation */
  lastInput: number
}

export interface AssistantSendRequest {
  /** Omitted for a new conversation */
  conversationId?: string
  text: string
  /** Saved project the conversation is about */
  projectPath?: string | null
  pageContext?: AssistantPageContext | null
  /** Skill of a new conversation (ignored for an existing one) */
  skill?: AssistantSkillId
  /** Effort of a new conversation, over the configured one (ignored for an existing one) */
  effort?: AssistantEffort | 'auto'
}

export type AssistantErrorCode = 'no-key' | 'auth' | 'rate' | 'network' | 'refusal' | 'truncated' | 'budget' | 'limit' | 'other'

export type AssistantEvent =
  | { conversationId: string; type: 'text'; delta: string }
  | { conversationId: string; type: 'tool'; id: string; name: string; summary: string }
  | { conversationId: string; type: 'tool-done'; id: string; ok: boolean }
  | { conversationId: string; type: 'error'; code: AssistantErrorCode; message: string }
  | { conversationId: string; type: 'done'; stopped: boolean }
  /** Forgy proposes an action: shown as a card, waits for decideAction unless auto-approved */
  | { conversationId: string; type: 'action'; id: string; title: string; preview: string; reversible: boolean; auto: boolean }
  | { conversationId: string; type: 'action-done'; id: string; status: AssistantActionStatus; output?: string }

// ─── Official AI tools (run on the user's own subscriptions) ─────────────────

export type AiToolId = 'claude-code' | 'codex' | 'antigravity' | 'gemini-cli'

export interface AiToolInfo {
  id: AiToolId
  name: string
  command: string
  installUrl: string
  installed: boolean
}

export interface AiToolsAPI {
  list: () => Promise<AiToolInfo[]>
  /** Opens a terminal running the tool in the project folder (home folder when null) */
  launch: (id: AiToolId, projectPath: string | null) => Promise<void>
}

export interface AssistantAPI {
  getConfig: () => Promise<AssistantConfig>
  saveConfig: (update: AssistantConfigUpdate) => Promise<AssistantConfig>
  /** Starts a turn; events follow on onEvent. Resolves with the conversation id at once */
  send: (req: AssistantSendRequest) => Promise<string>
  stop: (conversationId: string) => Promise<void>
  list: () => Promise<AssistantConversationSummary[]>
  get: (id: string) => Promise<AssistantConversation | null>
  remove: (id: string) => Promise<void>
  usage: () => Promise<AssistantUsage>
  onEvent: (cb: (e: AssistantEvent) => void) => () => void
  /** The desktop widget asks the app to show one of its conversations */
  onOpenConversation: (cb: (id: string) => void) => () => void
  /** Answer to an action card */
  decideAction: (id: string, approve: boolean) => Promise<void>
  /** Journal of actions, newest first */
  actions: () => Promise<AssistantAction[]>
  undoAction: (id: string) => Promise<AssistantAction>
}

/** Desktop widget window only */
export interface WidgetAPI {
  /** Fits the window to the content, anchored bottom-right above the taskbar */
  resize: (width: number, height: number) => Promise<void>
  /** Open: the window takes focus for typing. Collapsed: it never steals focus */
  setOpen: (open: boolean) => Promise<void>
  /** Brings DevForge to the front with this conversation in the assistant panel */
  openInApp: (conversationId: string | null) => Promise<void>
  /** The global shortcut that opens the widget, e.g. "Ctrl+Alt+Space" (null when none was free) */
  shortcut: () => Promise<string | null>
  /** Global shortcut pressed */
  onToggle: (cb: () => void) => () => void
}
