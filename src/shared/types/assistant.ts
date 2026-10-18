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
}

export interface AssistantConfigUpdate {
  apiKey?: string
  clearKey?: boolean
  model?: AssistantModel | 'auto'
  effort?: AssistantEffort | 'auto'
  monthlyBudget?: number
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
}

export type AssistantErrorCode = 'no-key' | 'auth' | 'rate' | 'network' | 'refusal' | 'truncated' | 'budget' | 'limit' | 'other'

export type AssistantEvent =
  | { conversationId: string; type: 'text'; delta: string }
  | { conversationId: string; type: 'tool'; id: string; name: string; summary: string }
  | { conversationId: string; type: 'tool-done'; id: string; ok: boolean }
  | { conversationId: string; type: 'error'; code: AssistantErrorCode; message: string }
  | { conversationId: string; type: 'done'; stopped: boolean }

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
}
