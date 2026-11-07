/**
 * v4.2: who answers for Forgy. Anthropic (Claude) is the default and the
 * only one with web search and a known price; the others speak OpenAI's chat
 * API (their own, or a compatible one), so one adapter serves them all.
 */

export type AssistantProvider = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'xai' | 'openrouter' | 'groq' | 'deepseek' | 'ollama' | 'custom'

export interface ProviderInfo {
  id: AssistantProvider
  /** A brand name: the same in every language */
  label: string
  /** OpenAI-compatible endpoint (without /chat/completions); '' for Anthropic, and for « custom » until given */
  baseUrl: string
  /** A key is needed (Ollama runs on this PC without one; a custom endpoint may not need one) */
  needsKey: boolean
  /** Read when no key is saved, as the SDKs do */
  env: string[]
  /** What a key looks like, for the field */
  placeholder: string
  /** The endpoint can be changed (a local or self-hosted server) */
  editableUrl?: boolean
  /** Sends `stream_options.include_usage` (the tokens of a streamed answer) */
  streamUsage?: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', baseUrl: '', needsKey: true, env: ['ANTHROPIC_API_KEY'], placeholder: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', needsKey: true, env: ['OPENAI_API_KEY'], placeholder: 'sk-…', streamUsage: true },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true, env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], placeholder: 'AIza…' },
  { id: 'mistral', label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', needsKey: true, env: ['MISTRAL_API_KEY'], placeholder: '…' },
  { id: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', needsKey: true, env: ['XAI_API_KEY'], placeholder: 'xai-…' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true, env: ['OPENROUTER_API_KEY'], placeholder: 'sk-or-…', streamUsage: true },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true, env: ['GROQ_API_KEY'], placeholder: 'gsk_…', streamUsage: true },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', needsKey: true, env: ['DEEPSEEK_API_KEY'], placeholder: 'sk-…', streamUsage: true },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', needsKey: false, env: [], placeholder: '', editableUrl: true, streamUsage: true },
  { id: 'custom', label: 'OpenAI-compatible', baseUrl: '', needsKey: false, env: [], placeholder: '…', editableUrl: true }
]

export const isProvider = (v: unknown): v is AssistantProvider => PROVIDERS.some(p => p.id === v)
export const providerInfo = (id: AssistantProvider): ProviderInfo => PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0]
