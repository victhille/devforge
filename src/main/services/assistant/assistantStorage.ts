import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantConfig, AssistantConfigUpdate, AssistantConversation, AssistantConversationSummary, AssistantEffort, AssistantModel
} from '@shared/types'

const MODELS: AssistantModel[] = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const EFFORTS: AssistantEffort[] = ['low', 'medium', 'high']

const dir = () => join(app.getPath('userData'), 'assistant')
const configPath = () => join(dir(), 'config.json')
const conversationsDir = () => join(dir(), 'conversations')

interface StoredConfig { keyEnc?: string; model?: AssistantModel; effort?: AssistantEffort }

function readConfig(): StoredConfig {
  try { return JSON.parse(readFileSync(configPath(), 'utf-8')) as StoredConfig } catch { return {} }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(data), 'utf-8')
}

export function getConfig(): AssistantConfig {
  const c = readConfig()
  return {
    hasKey: !!c.keyEnc,
    model: c.model && MODELS.includes(c.model) ? c.model : 'claude-opus-5-5',
    effort: c.effort && EFFORTS.includes(c.effort) ? c.effort : 'medium'
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
  writeJson(configPath(), c)
  return getConfig()
}

// ─── Conversations ────────────────────────────────────────────────────────────

/** Stored conversation: what the UI shows + the raw API history (append-only) */
export interface StoredConversation extends AssistantConversation {
  api: Anthropic.Beta.BetaMessageParam[]
  /** Project whose context was last given to the model */
  contextProject: string | null
}

const ID_RE = /^[\w-]{8,64}$/
const convPath = (id: string) => {
  if (!ID_RE.test(id)) throw new Error('Invalid conversation id')
  return join(conversationsDir(), `${id}.json`)
}

export function loadConversation(id: string): StoredConversation | null {
  try { return JSON.parse(readFileSync(convPath(id), 'utf-8')) as StoredConversation } catch { return null }
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
  const { api: _api, contextProject: _p, ...rest } = c
  return rest
}
