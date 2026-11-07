import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import { writeJsonFile } from '../../lib/jsonFile'
import type Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantActionMode, AssistantConfig, AssistantConfigUpdate, AssistantConversation, AssistantConversationSummary, AssistantEffort, AssistantModel, AssistantProvider, AssistantUsage
} from '@shared/types'
import { isProvider, providerInfo, PROVIDERS } from '@shared/data/assistantProviders'

const MODELS: (AssistantModel | 'auto')[] = ['auto', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const EFFORTS: (AssistantEffort | 'auto')[] = ['auto', 'low', 'medium', 'high']
const DEFAULT_BUDGET = 5

const dir = () => join(app.getPath('userData'), 'assistant')
const configPath = () => join(dir(), 'config.json')
const conversationsDir = () => join(dir(), 'conversations')

interface StoredConfig {
  /** Anthropic's key (where it always was) */
  keyEnc?: string
  /** v4.2: the other providers' keys, each encrypted */
  keysEnc?: Partial<Record<AssistantProvider, string>>
  provider?: AssistantProvider
  /** v4.2: the model and the endpoint chosen for each provider */
  models?: Partial<Record<AssistantProvider, string>>
  baseUrls?: Partial<Record<AssistantProvider, string>>
  model?: AssistantModel | 'auto'; effort?: AssistantEffort | 'auto'; monthlyBudget?: number; desktopWidget?: boolean; actionMode?: AssistantActionMode
}

function readConfig(): StoredConfig {
  try { return JSON.parse(readFileSync(configPath(), 'utf-8')) as StoredConfig } catch { return {} }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeJsonFile(path, data, false)
}

/** The key the environment gives a provider (OPENAI_API_KEY…), as its own SDK would read it */
export function envKeyFor(p: AssistantProvider): string | null {
  // An unknown provider reads nothing (providerInfo would give Anthropic's variables)
  if (!isProvider(p)) return null
  for (const name of providerInfo(p).env) { const v = process.env[name]?.trim(); if (v) return v }
  return null
}

/** ANTHROPIC_API_KEY, which the SDK reads when no key is saved */
export const envApiKey = (): string | null => envKeyFor('anthropic')

const savedKey = (c: StoredConfig, p: AssistantProvider) => (p === 'anthropic' ? c.keyEnc : c.keysEnc?.[p])
const activeOf = (c: StoredConfig): AssistantProvider => (isProvider(c.provider) ? c.provider : 'anthropic')

/**
 * v4.2: the endpoint a provider is reached at. Only a local or custom
 * server's address can be chosen: a known provider is always reached at its
 * own, so that its key never goes anywhere else.
 */
export function endpointOf(p: AssistantProvider): string {
  return storedEndpoint(readConfig(), p) || providerInfo(p).baseUrl
}

/**
 * The address chosen for a local or custom server, checked again each time it
 * is read: the config file may come from elsewhere (changed by hand, an old
 * version); one that would not be accepted today is left out ('').
 */
function storedEndpoint(c: StoredConfig, p: AssistantProvider): string {
  const raw = providerInfo(p).editableUrl ? c.baseUrls?.[p] : ''
  if (!raw) return ''
  try { return checkEndpoint(raw, p === 'ollama') } catch { return '' }
}

/** This PC, whatever it is called */
const isLocalHost = (h: string) => ['localhost', '127.0.0.1', '[::1]'].includes(h)
/** A machine of the home or office network: private IPv4, a .local / .lan / .home.arpa name, or a bare name (« nas ») */
const isLanHost = (h: string) =>
  /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(h) || /\.(local|lan|home\.arpa)$/.test(h) || /^[a-z0-9-]+$/.test(h)

/**
 * An endpoint one may choose: https; or plain http to this PC only, since a
 * key would travel in clear. `lan`: Ollama, which never gets a key, may also
 * be on a machine of the local network. A name and a password in the
 * address are refused (they would be kept in clear, and shown back): a key
 * goes in its own field. The errors are codes the window puts in words.
 */
export function checkEndpoint(raw: string, lan = false): string {
  const url = raw.trim().replace(/\/+$/, '')
  if (!url) return ''
  let u: URL
  try { u = new URL(url) } catch { throw new Error('URL_INVALID') }
  if (u.username || u.password) throw new Error('URL_CREDENTIALS')
  if (u.protocol === 'https:') return url
  if (u.protocol !== 'http:') throw new Error('URL_INVALID')
  const host = u.hostname.toLowerCase()
  if (isLocalHost(host) || (lan && isLanHost(host))) return url
  throw new Error(lan ? 'URL_HTTP_REMOTE_LAN' : 'URL_HTTP_REMOTE')
}

export function getConfig(): AssistantConfig {
  const c = readConfig()
  const provider = activeOf(c)
  const keys: AssistantConfig['keys'] = {}
  for (const p of PROVIDERS) {
    const source = savedKey(c, p.id) ? 'saved' : envKeyFor(p.id) ? 'env' : null
    if (source) keys[p.id] = source
  }
  const keySource = keys[provider] ?? null
  const info = providerInfo(provider)
  const baseUrl = storedEndpoint(c, provider)
  return {
    // Ollama needs no key; an endpoint of one's own may not either, once it is given
    hasKey: keySource !== null || (!info.needsKey && !!(baseUrl || info.baseUrl)),
    keySource,
    model: c.model && MODELS.includes(c.model) ? c.model : 'auto',
    effort: c.effort && EFFORTS.includes(c.effort) ? c.effort : 'auto',
    monthlyBudget: typeof c.monthlyBudget === 'number' && c.monthlyBudget >= 0 ? c.monthlyBudget : DEFAULT_BUDGET,
    desktopWidget: c.desktopWidget === true,
    actionMode: c.actionMode === 'auto-safe' ? 'auto-safe' : 'ask',
    provider,
    providerModel: c.models?.[provider] ?? '',
    baseUrl,
    keys
  }
}

/** Main process only: the decrypted key saved for a provider (Anthropic's by default), if one is */
export function getApiKey(p: AssistantProvider = 'anthropic'): string | null {
  const enc = savedKey(readConfig(), p)
  if (!enc) return null
  try { return safeStorage.decryptString(Buffer.from(enc, 'base64')) } catch { return null }
}

/** The key a provider is called with: the saved one, else the environment's; never one for Ollama (it may be on the local network, in clear) */
export const keyFor = (p: AssistantProvider): string | null => (!isProvider(p) || p === 'ollama' ? null : getApiKey(p) ?? envKeyFor(p))

export function saveConfig(u: AssistantConfigUpdate): AssistantConfig {
  const c = readConfig()
  const target: AssistantProvider = isProvider(u.keyFor) ? u.keyFor : 'anthropic'
  if (u.clearKey) {
    if (target === 'anthropic') delete c.keyEnc
    else if (c.keysEnc) delete c.keysEnc[target]
  }
  if (u.apiKey?.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    const enc = safeStorage.encryptString(u.apiKey.trim()).toString('base64')
    if (target === 'anthropic') c.keyEnc = enc
    else c.keysEnc = { ...c.keysEnc, [target]: enc }
  }
  if (isProvider(u.provider)) c.provider = u.provider
  const active = activeOf(c)
  if (typeof u.providerModel === 'string') c.models = { ...c.models, [active]: u.providerModel.trim().slice(0, 200) }
  if (typeof u.baseUrl === 'string') {
    // A known provider keeps its own address (its key must not be sent elsewhere)
    if (!providerInfo(active).editableUrl) throw new Error('URL_FIXED')
    c.baseUrls = { ...c.baseUrls, [active]: checkEndpoint(u.baseUrl, active === 'ollama') }
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
  // Conversations saved before skills and cost tracking; a provider not known (a file changed by hand) is left out: Anthropic, the default
  return {
    ...c,
    provider: isProvider(c.provider) ? c.provider : undefined,
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
