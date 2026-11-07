import { randomUUID } from 'crypto'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * v4.2: Forgy on a provider other than Anthropic, through OpenAI's chat API
 * (OpenAI, Gemini, Mistral, xAI, OpenRouter, Groq, DeepSeek, Ollama, any
 * compatible server). The conversation stays stored as Anthropic messages:
 * it is turned into chat messages for each request, and the answer comes
 * back as Anthropic content (text, tool_use) the loop already knows.
 */

type History = Anthropic.Beta.BetaMessageParam[]
interface ToolDef { name: string; description?: string; input_schema: unknown }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string }

/** A request that failed, in the loop's words */
export class CompatError extends Error {
  constructor(public code: 'auth' | 'rate' | 'network' | 'timeout' | 'other', message: string, public status?: number) { super(message) }
}

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map(b => (b && typeof b === 'object' && (b as { type?: string }).type === 'text' ? String((b as { text?: unknown }).text ?? '') : '')).filter(Boolean).join('\n\n')
}

/**
 * The stored conversation as chat messages: the system text first; a tool's
 * result right after the call it answers (a message of its own); what the
 * model only shows to itself (thinking, Anthropic's web searches) left out.
 */
export function toChatMessages(system: string, history: History): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'system', content: system }]
  for (const m of history) {
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content as { type: string }[])
    if (m.role === 'user') {
      for (const b of blocks) {
        if (b.type !== 'tool_result') continue
        const r = b as Anthropic.Beta.BetaToolResultBlockParam
        out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: (r.is_error ? 'Error: ' : '') + textOf(r.content) })
      }
      const text = textOf(blocks.filter(b => b.type === 'text'))
      if (text) out.push({ role: 'user', content: text })
    } else {
      const text = textOf(blocks.filter(b => b.type === 'text'))
      const calls = blocks.filter(b => b.type === 'tool_use').map(b => {
        const t = b as Anthropic.Beta.BetaToolUseBlockParam
        return { id: t.id, type: 'function' as const, function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) } }
      })
      if (!text && !calls.length) continue
      out.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) })
    }
  }
  return out
}

/** Forgy's tools as functions (Anthropic's own server tools, like web search, have no equivalent and are left out) */
export function toChatTools(tools: unknown[]): { type: 'function'; function: { name: string; description: string; parameters: unknown } }[] {
  return (tools as ToolDef[])
    .filter(t => t && typeof t.name === 'string' && t.input_schema)
    .map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description ?? '', parameters: t.input_schema } }))
}

export interface CompatAnswer {
  /** As an Anthropic message's content: the text, then the tool calls */
  content: Anthropic.Beta.BetaContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal'
  usage: { input: number; output: number }
  model: string
}

const STOPS: Record<string, CompatAnswer['stop_reason']> = { stop: 'end_turn', tool_calls: 'tool_use', function_call: 'tool_use', length: 'max_tokens', content_filter: 'refusal' }

/**
 * A response body, read up to `max` bytes: beyond, the rest is not read and
 * the connection is closed (a server could otherwise send without end).
 */
async function readCapped(res: Response, max: number): Promise<{ text: string; over: boolean }> {
  if (!res.body) return { text: '', over: false }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return { text: text + decoder.decode(), over: false }
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return { text, over: true }
    }
    text += decoder.decode(value, { stream: true })
  }
}

async function failure(res: Response): Promise<CompatError> {
  let detail = ''
  try {
    const { text: body } = await readCapped(res, 64 * 1024)
    try {
      const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string }
      detail = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? body
    } catch { detail = body }
  } catch { /* no body */ }
  detail = detail.slice(0, 300)
  if (res.status === 401 || res.status === 403) return new CompatError('auth', detail || 'Key rejected', res.status)
  if (res.status === 429) return new CompatError('rate', detail || 'Rate limited', res.status)
  return new CompatError('other', `API ${res.status}${detail ? `: ${detail}` : ''}`, res.status)
}

/** One answer at most this long: a server that stops sending never holds Forgy forever */
const TURN_TIMEOUT = 10 * 60_000
/** A whole answer (its text and all its tool calls together), or a line of the stream, at most (a server could otherwise fill the memory) */
const MAX_ANSWER = 8 * 1024 * 1024
/** A tool's name, at most (OpenAI allows 64 characters) */
const MAX_NAME = 128
/** A number the server sends, or 0 */
const count = (v: unknown, prev: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : prev)
/** Tool calls in one answer, at most (an index out of this range is left out) */
const MAX_CALLS = 64
/**
 * A tool call's id is DevForge's own, never the server's: the approval of an
 * action card waits on it, so a server could otherwise reuse one to have a
 * card approved for another. Nine letters or digits (Mistral asks exactly that).
 */
const freshId = () => randomUUID().replace(/-/g, '').slice(0, 9)

const headers = (apiKey: string | null) => ({ 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) })

/**
 * One request, streamed: each piece of text goes to `onText` as it comes;
 * the tool calls are put together from their pieces. An abort throws an
 * AbortError; a failed request a CompatError.
 */
export async function compatTurn(o: {
  baseUrl: string; apiKey: string | null; model: string; system: string; history: History; tools: unknown[]
  streamUsage?: boolean; signal: AbortSignal; onText: (delta: string) => void
}): Promise<CompatAnswer> {
  const tools = toChatTools(o.tools)
  const signal = AbortSignal.any([o.signal, AbortSignal.timeout(TURN_TIMEOUT)])
  /** The user's stop goes on as an abort; the time limit becomes a network failure */
  const lost = (err: unknown) => {
    if (o.signal.aborted) return err
    if (signal.aborted) return new CompatError('timeout', 'No answer after 10 minutes')
    return err instanceof CompatError ? err : new CompatError('network', err instanceof Error ? err.message : String(err))
  }
  let res: Response
  try {
    res = await fetch(`${o.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      // A redirect is refused: the key must not follow it to another host
      method: 'POST', headers: headers(o.apiKey), signal, redirect: 'error',
      body: JSON.stringify({
        // No max_tokens: OpenAI's reasoning models refuse it, and each server has its own cap
        model: o.model, stream: true,
        messages: toChatMessages(o.system, o.history),
        ...(tools.length ? { tools } : {}),
        ...(o.streamUsage ? { stream_options: { include_usage: true } } : {})
      })
    })
  } catch (err) {
    throw lost(err)
  }
  if (!res.ok || !res.body) throw await failure(res)

  let text = ''
  let stop: CompatAnswer['stop_reason'] = 'end_turn'
  let model = o.model
  const usage = { input: 0, output: 0 }
  const calls: { name: string; args: string }[] = []
  /** What the answer holds so far: its text and every tool call, together */
  let size = 0
  const grow = (n: number, what: string) => {
    size += n
    if (size > MAX_ANSWER) throw new CompatError('other', `${what} too large`)
  }
  // Whatever the server sends is checked before use: a number may come as text, an object where text was expected
  const take = (data: string) => {
    let chunk: {
      model?: unknown; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
      choices?: { delta?: { content?: unknown; tool_calls?: { index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }[] }; finish_reason?: unknown }[]
      error?: { message?: unknown } | string
    }
    try { chunk = JSON.parse(data) } catch { return }
    if (!chunk || typeof chunk !== 'object') return
    if (chunk.error) {
      const said = typeof chunk.error === 'string' ? chunk.error : chunk.error.message
      throw new CompatError('other', typeof said === 'string' && said ? said.slice(0, 300) : 'Error in the stream')
    }
    if (typeof chunk.model === 'string' && chunk.model) model = chunk.model.slice(0, 200)
    if (chunk.usage) { usage.input = count(chunk.usage.prompt_tokens, usage.input); usage.output = count(chunk.usage.completion_tokens, usage.output) }
    const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined
    if (!choice) return
    const delta = choice.delta?.content
    if (typeof delta === 'string' && delta) {
      grow(delta.length, 'Answer')
      text += delta
      o.onText(delta)
    }
    for (const t of Array.isArray(choice.delta?.tool_calls) ? choice.delta.tool_calls : []) {
      // Pieces of one call share its index; an index out of range is left out (a huge one would freeze the app)
      if (!t || typeof t !== 'object') continue
      const i = t.index ?? calls.length
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= MAX_CALLS) continue
      calls[i] ??= { name: '', args: '' }
      const name = t.function?.name
      const args = t.function?.arguments
      if (typeof name === 'string' && name) {
        grow(name.length, 'Tool call')
        calls[i].name += name
        if (calls[i].name.length > MAX_NAME) throw new CompatError('other', 'Tool call too large')
      }
      if (typeof args === 'string' && args) {
        grow(args.length, 'Tool call')
        calls[i].args += args
      }
    }
    // Only a reason of our own list (« __proto__ » would find an inherited object)
    const reason = choice.finish_reason
    if (typeof reason === 'string' && reason) stop = Object.hasOwn(STOPS, reason) ? STOPS[reason] : 'end_turn'
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      if (pending.length > MAX_ANSWER) throw new CompatError('other', 'Answer too large')
      let at: number
      while ((at = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, at).trim()
        pending = pending.slice(at + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data && data !== '[DONE]') take(data)
      }
    }
    const last = pending.trim()
    if (last.startsWith('data:') && last.slice(5).trim() !== '[DONE]') take(last.slice(5).trim())
  } catch (err) {
    // Our own refusal (too large, an error in the stream) closes the connection: a paid server would go on writing, and billing
    await reader.cancel().catch(() => {})
    throw lost(err)
  }

  const content: Anthropic.Beta.BetaContentBlock[] = []
  if (text) content.push({ type: 'text', text, citations: null } as Anthropic.Beta.BetaContentBlock)
  for (const c of calls.filter(Boolean)) {
    if (!c.name) continue
    let input: unknown
    try { input = c.args.trim() ? JSON.parse(c.args) : {} } catch { input = { _unparsed: c.args.slice(0, 2000) } }
    content.push({ type: 'tool_use', id: freshId(), name: c.name, input } as Anthropic.Beta.BetaContentBlock)
  }
  // Some servers end with « stop » while asking for tools
  if (content.some(b => b.type === 'tool_use') && stop === 'end_turn') stop = 'tool_use'
  return { content, stop_reason: stop, usage, model }
}

/** The models a provider offers (its /models list), sorted */
export async function compatModels(baseUrl: string, apiKey: string | null): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, { headers: headers(apiKey), signal: AbortSignal.timeout(15_000), redirect: 'error' })
  } catch (err) { throw new CompatError('network', err instanceof Error ? err.message : String(err)) }
  if (!res.ok) throw await failure(res)
  // A list read with a limit: its names go to the window
  const { text, over } = await readCapped(res, 2 * 1024 * 1024)
  if (over) throw new CompatError('other', 'Model list too large')
  let body: { data?: unknown; models?: unknown }
  try { body = JSON.parse(text) ?? {} } catch { throw new CompatError('other', 'Not a model list') }
  const items = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : []
  const list = (items as { id?: unknown; name?: unknown }[])
    .map(m => (typeof m?.id === 'string' ? m.id : typeof m?.name === 'string' ? m.name : ''))
    .filter(id => id && id.length <= 200)
  // Gemini names them models/xxx
  return [...new Set(list.map(id => id.replace(/^models\//, '')))].sort((a, b) => a.localeCompare(b)).slice(0, 2000)
}
