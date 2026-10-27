import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import { writeJsonFile } from '../../lib/jsonFile'
import type Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantActionMode, AssistantConfig, AssistantConfigUpdate, AssistantConversation, AssistantConversationSummary, AssistantEffort, AssistantModel, AssistantUsage
} from '@shared/types'

const MODELS: (AssistantModel | 'auto')[] = ['auto', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const EFFORTS: (AssistantEffort | 'auto')[] = ['auto', 'low', 'medium', 'high']
const DEFAULT_BUDGET = 5

const dir = () => join(app.getPath('userData'), 'assistant')
const configPath = () => join(dir(), 'config.json')
const conversationsDir = () => join(dir(), 'conversations')

interface StoredConfig { keyEnc?: string; model?: AssistantModel | 'auto'; effort?: AssistantEffort | 'auto'; monthlyBudget?: number; desktopWidget?: boolean; actionMode?: AssistantActionMode }

function readConfig(): StoredConfig {
  try { return JSON.parse(readFileSync(configPath(), 'utf-8')) as StoredConfig } catch { return {} }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeJsonFile(path, data, false)
}

/** ANTHROPIC_API_KEY, which the SDK reads when no key is saved */
export function envApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

export function getConfig(): AssistantConfig {
  const c = readConfig()
  const keySource = c.keyEnc ? 'saved' : envApiKey() ? 'env' : null
  return {
    hasKey: keySource !== null,
    keySource,
    model: c.model && MODELS.includes(c.model) ? c.model : 'auto',
    effort: c.effort && EFFORTS.includes(c.effort) ? c.effort : 'auto',
    monthlyBudget: typeof c.monthlyBudget === 'number' && c.monthlyBudget >= 0 ? c.monthlyBudget : DEFAULT_BUDGET,
    desktopWidget: c.desktopWidget === true,
    actionMode: c.actionMode === 'auto-safe' ? 'auto-safe' : 'ask'
  }
}

/** Main process only: the decrypted API key, if one is saved */
export function getApiKey(): string | null {
  const enc = readConfig().keyEnc
  if (!enc) return null
  try { return safeStorage.decryptString(Buffer.from(enc, 'base64')) } catch { return null }
}

export function saveConfig(u: AssistantConfigUpdate): AssistantConfig {
  const c = readConfig()
  if (u.clearKey) delete c.keyEnc
  if (u.apiKey?.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    c.keyEnc = safeStorage.encryptString(u.apiKey.trim()).toString('base64')
  }
  if (u.model && MODELS.includes(u.model)) c.model = u.model
  if (u.effort && EFFORTS.includes(u.effort)) c.effort = u.effort
  if (typeof u.monthlyBudget === 'number' && Number.isFinite(u.monthlyBudget) && u.monthlyBudget >= 0) c.monthlyBudget = Math.round(u.monthlyBudget * 100) / 100
  if (typeof u.desktopWidget === 'boolean') c.desktopWidget = u.desktopWidget
  if (u.actionMode === 'ask' || u.actionMode === 'auto-safe') c.actionMode = u.actionMode
  writeJson(configPath(), c)
  return getConfig()
}

// ─── Monthly spending ─────────────────────────────────────────────────────────

const usagePath = () => join(dir(), 'usage.json')
const thisMonth = () => new Date().toISOString().slice(0, 7)

function readUsage(): Record<string, number> {
  try { return JSON.parse(readFileSync(usagePath(), 'utf-8')) as Record<string, number> } catch { return {} }
}

export function addSpending(cost: number): void {
  if (!(cost > 0)) return
  const u = readUsage()
  u[thisMonth()] = (u[thisMonth()] ?? 0) + cost
  writeJson(usagePath(), u)
}

export function monthUsage(): AssistantUsage {
  return { month: thisMonth(), spent: readUsage()[thisMonth()] ?? 0, budget: getConfig().monthlyBudget }
}

// ─── Conversations ────────────────────────────────────────────────────────────

/** Stored conversation: what the UI shows + the raw API history (append-only) */
export interface StoredConversation extends AssistantConversation {
  api: Anthropic.Beta.BetaMessageParam[]
  effort: AssistantEffort
  /** Project whose context was last given to the model */
  contextProject: string | null
}

const ID_RE = /^[\w-]{8,64}$/
const convPath = (id: string) => {
  if (!ID_RE.test(id)) throw new Error('Invalid conversation id')
  return join(conversationsDir(), `${id}.json`)
}

export function loadConversation(id: string): StoredConversation | null {
  let c: StoredConversation
  try { c = JSON.parse(readFileSync(convPath(id), 'utf-8')) as StoredConversation } catch { return null }
  // Conversations saved before skills and cost tracking
  return {
    ...c,
    skill: c.skill ?? 'chat', model: c.model ?? 'claude-opus-5-5', effort: c.effort ?? 'medium',
    cost: c.cost ?? 0, tokens: c.tokens ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, lastInput: c.lastInput ?? 0
  }
}

export function saveConversation(c: StoredConversation): void {
  writeJson(convPath(c.id), c)
}

export function removeConversation(id: string): void {
  rmSync(convPath(id), { force: true })
}

const MAX_KEPT = 100

export function listConversations(): AssistantConversationSummary[] {
  if (!existsSync(conversationsDir())) return []
  const all = readdirSync(conversationsDir())
    .filter(f => f.endsWith('.json'))
    .map(f => loadConversation(f.slice(0, -5)))
    .filter((c): c is StoredConversation => !!c)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  // Oldest beyond the limit are dropped
  for (const old of all.slice(MAX_KEPT)) removeConversation(old.id)
  return all.slice(0, MAX_KEPT).map(({ id, title, updatedAt, projectName }) => ({ id, title, updatedAt, projectName }))
}

/** Displayed form, without the raw history */
export function publicConversation(c: StoredConversation): AssistantConversation {
  const { api: _api, contextProject: _p, effort: _e, ...rest } = c
  return rest
}
