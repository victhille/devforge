import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantEvent } from '@shared/types'
import { CompatError, compatModels, compatTurn, toChatMessages, toChatTools } from '../../src/main/services/assistant/openaiCompat'
import { endpointOf, getApiKey, getConfig, keyFor, loadConversation, saveConfig } from '../../src/main/services/assistant/assistantStorage'
import { providerModels, sendToAssistant, setAssistantEmitter } from '../../src/main/services/assistant/assistantService'
import { importConfig } from '../../src/main/services/storage/profile'
import { saveProjects, tempDir, userData } from '../helpers'

/** v4.2: Forgy on providers other than Anthropic — an OpenAI-compatible API, a key per provider */

// A small OpenAI-compatible server: each request takes the next scripted answer
// `endless`: a server that never stops writing (one SSE chunk again and again, or a body of x), until the client closes
type Answer = { status?: number; body?: unknown; sse?: unknown[]; headers?: Record<string, string>; endless?: { sse?: unknown; status?: number } }
const server = { script: [] as Answer[], requests: [] as { url: string; auth?: string; body: Record<string, unknown> }[], closed: false }
let http: Server
let base = ''
beforeAll(async () => {
  http = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      server.requests.push({ url: req.url ?? '', auth: req.headers.authorization, body: raw ? JSON.parse(raw) : {} })
      const a = server.script.shift() ?? { status: 500, body: { error: { message: 'no script' } } }
      if (a.endless) {
        const sse = a.endless.sse !== undefined
        res.writeHead(a.endless.status ?? 200, { 'Content-Type': sse ? 'text/event-stream' : 'application/json' })
        const piece = sse ? `data: ${JSON.stringify(a.endless.sse)}\n\n` : 'x'.repeat(64 * 1024)
        const tick = setInterval(() => res.write(piece), 2)
        res.on('close', () => { clearInterval(tick); server.closed = true })
        return
      }
      if (a.sse) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        for (const chunk of a.sse) res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        res.end('data: [DONE]\n\n')
        return
      }
      res.writeHead(a.status ?? 200, { 'Content-Type': 'application/json', ...a.headers })
      res.end(JSON.stringify(a.body ?? {}))
    })
  })
  await new Promise<void>(r => http.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}/v1`
})
afterAll(() => http.close())
beforeEach(() => { server.script = []; server.requests = []; server.closed = false })

const delta = (d: Record<string, unknown>, finish: string | null = null) => ({ model: 'llama-test', choices: [{ index: 0, delta: d, finish_reason: finish }] })

describe('the chat messages a stored conversation becomes', () => {
  it('a tool result right after its call, its own message; thinking left out', () => {
    const out = toChatMessages('You are Forgy', [
      { role: 'user', content: [{ type: 'text', text: '<project_context>…</project_context>' }, { type: 'text', text: 'Lis a.ts' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'hm', signature: 's' }, { type: 'text', text: 'Je regarde.' }, { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'a.ts' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'export const a = 1' }, { type: 'tool_result', tool_use_id: 'c2', content: [{ type: 'text', text: 'gone' }], is_error: true }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a vaut 1.' }] }
    ] as never)
    expect(out).toEqual([
      { role: 'system', content: 'You are Forgy' },
      { role: 'user', content: '<project_context>…</project_context>\n\nLis a.ts' },
      { role: 'assistant', content: 'Je regarde.', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: 'export const a = 1' },
      { role: 'tool', tool_call_id: 'c2', content: 'Error: gone' },
      { role: 'assistant', content: 'a vaut 1.' }
    ])
  })

  it('the tools as functions, Anthropic’s server tools left out', () => {
    expect(toChatTools([{ name: 'read_file', description: 'Read', input_schema: { type: 'object' } }, { type: 'web_search_20260209', name: 'web_search' }]))
      .toEqual([{ type: 'function', function: { name: 'read_file', description: 'Read', parameters: { type: 'object' } } }])
  })
})

describe('compatTurn', () => {
  it('streams the text, puts a tool call together from its pieces, counts the tokens', async () => {
    server.script.push({ sse: [
      delta({ role: 'assistant', content: 'Je ' }), delta({ content: 'cherche.' }),
      delta({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'search_code', arguments: '{"que' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: 'ry":"hello"}' } }] }, 'tool_calls'),
      { choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } }
    ] })
    const pieces: string[] = []
    const a = await compatTurn({ baseUrl: base, apiKey: 'sk-test', model: 'llama-test', system: 'S', history: [{ role: 'user', content: 'Où est hello ?' }], tools: [{ name: 'search_code', input_schema: { type: 'object' } }], streamUsage: true, signal: new AbortController().signal, onText: d => pieces.push(d) })
    expect(pieces).toEqual(['Je ', 'cherche.'])
    expect(a.stop_reason).toBe('tool_use')
    // The call's id is DevForge's own, never the server's « call_1 »
    expect(a.content).toEqual([expect.objectContaining({ type: 'text', text: 'Je cherche.' }), { type: 'tool_use', id: expect.stringMatching(/^[0-9a-f]{9}$/), name: 'search_code', input: { query: 'hello' } }])
    expect(a.usage).toEqual({ input: 120, output: 30 })
    const sent = server.requests[0]
    expect(sent.url).toBe('/v1/chat/completions')
    expect(sent.auth).toBe('Bearer sk-test')
    expect(sent.body).toMatchObject({ model: 'llama-test', stream: true, stream_options: { include_usage: true }, tools: [{ type: 'function', function: { name: 'search_code' } }] })
    expect(sent.body.max_tokens).toBeUndefined()
  })

  it('says why a request failed: a key refused, too many requests, a server out of reach', async () => {
    const turn = (url = base) => compatTurn({ baseUrl: url, apiKey: null, model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} })
    server.script.push({ status: 401, body: { error: { message: 'Incorrect API key' } } })
    await expect(turn()).rejects.toMatchObject({ code: 'auth', message: 'Incorrect API key' })
    server.script.push({ status: 429, body: { error: 'slow down' } })
    await expect(turn()).rejects.toMatchObject({ code: 'rate' })
    await expect(turn('http://127.0.0.1:1/v1')).rejects.toBeInstanceOf(CompatError)
    await expect(turn('http://127.0.0.1:1/v1')).rejects.toMatchObject({ code: 'network' })
  })

  it('a server cannot choose the ids of its calls, nor freeze the app with a huge index', async () => {
    server.script.push({ sse: [
      delta({ tool_calls: [{ index: 0, id: 'same', function: { name: 'git_status', arguments: '{}' } }, { index: 1, id: 'same', function: { name: 'git_status', arguments: '{}' } }] }),
      delta({ tool_calls: [{ index: 1e9, id: 'x', function: { name: 'read_file', arguments: '{}' } }, { index: -1, function: { name: 'read_file' } }] }, 'tool_calls')
    ] })
    const a = await compatTurn({ baseUrl: base, apiKey: null, model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} })
    const ids = a.content.map(b => (b as { id?: string }).id)
    expect(a.content.map(b => (b as { name?: string }).name)).toEqual(['git_status', 'git_status'])
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain('same')
  })

  it('cuts an answer too large, and refuses a redirect (the key must not follow it)', async () => {
    const turn = () => compatTurn({ baseUrl: base, apiKey: 'sk-test', model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} })
    const big = 'x'.repeat(1024 * 1024)
    server.script.push({ sse: Array.from({ length: 9 }, () => delta({ content: big })) })
    await expect(turn()).rejects.toMatchObject({ code: 'other', message: 'Answer too large' })
    server.script.push({ status: 307, body: {}, headers: { Location: 'https://elsewhere.example/v1/chat/completions' } })
    await expect(turn()).rejects.toMatchObject({ code: 'network' })
    expect(server.requests).toHaveLength(2)
  })

  it('bounds a whole answer: its text and its tool calls together, and a tool’s name', async () => {
    const turn = () => compatTurn({ baseUrl: base, apiKey: null, model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} })
    // 5 MB of text and 4 MB of input: each under the limit, too much together
    server.script.push({ sse: [delta({ content: 'a'.repeat(5 * 1024 * 1024) }), delta({ tool_calls: [{ index: 0, function: { name: 't', arguments: 'b'.repeat(4 * 1024 * 1024) } }] })] })
    await expect(turn()).rejects.toMatchObject({ code: 'other', message: 'Tool call too large' })
    server.script.push({ sse: [delta({ tool_calls: [{ index: 0, function: { name: 'n'.repeat(200), arguments: '{}' } }] })] })
    await expect(turn()).rejects.toMatchObject({ code: 'other', message: 'Tool call too large' })
  })

  it('closes the connection when it refuses an answer (a paid server would go on writing)', async () => {
    server.script.push({ endless: { sse: delta({ tool_calls: [{ index: 0, function: { name: 'x'.repeat(50) } }] }) } })
    await expect(compatTurn({ baseUrl: base, apiKey: null, model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} }))
      .rejects.toMatchObject({ message: 'Tool call too large' })
    await vi.waitFor(() => expect(server.closed).toBe(true))
  })

  it('reads an error’s body and the list of models with a limit', async () => {
    server.script.push({ endless: { status: 400 } })
    await expect(compatTurn({ baseUrl: base, apiKey: null, model: 'm', system: 'S', history: [], tools: [], signal: new AbortController().signal, onText: () => {} }))
      .rejects.toMatchObject({ code: 'other', status: 400 })
    await vi.waitFor(() => expect(server.closed).toBe(true))
    server.closed = false
    server.script.push({ endless: {} })
    await expect(compatModels(base, null)).rejects.toMatchObject({ message: 'Model list too large' })
    await vi.waitFor(() => expect(server.closed).toBe(true))
    server.script.push({ body: { data: [{ id: 'ok-model' }, { id: { nested: true } }, { id: 'y'.repeat(300) }, { name: 'named' }] } })
    expect(await compatModels(base, null)).toEqual(['named', 'ok-model'])
  })

  it('checks what the server sends: a number as text, an object as text, are left out', async () => {
    server.script.push({ sse: [
      { model: 42, choices: [{ index: 0, delta: { content: { not: 'text' } }, finish_reason: null }] },
      delta({ content: 'ok' }, 'stop'),
      { choices: [{ index: 0, delta: { tool_calls: [null] }, finish_reason: '__proto__' }] },
      { choices: [], usage: { prompt_tokens: '999', completion_tokens: 12 } }
    ] })
    const a = await compatTurn({ baseUrl: base, apiKey: null, model: 'mine', system: 'S', history: [], tools: [], streamUsage: true, signal: new AbortController().signal, onText: () => {} })
    expect(a.usage).toEqual({ input: 0, output: 12 })
    expect(a.stop_reason).toBe('end_turn')
    expect(a.content).toEqual([{ type: 'text', text: 'ok', citations: null }])
    expect(a.model).toBe('llama-test')
  })

  it('lists the models, sorted, without Gemini’s models/ prefix', async () => {
    server.script.push({ body: { data: [{ id: 'models/gemini-b' }, { id: 'gemini-a' }, { id: 'models/gemini-b' }] } })
    expect(await compatModels(base, 'k')).toEqual(['gemini-a', 'gemini-b'])
    expect(server.requests[0].url).toBe('/v1/models')
  })
})

describe('the keys, one per provider', () => {
  it('kept side by side; the active provider says whether Forgy can talk', () => {
    saveConfig({ apiKey: 'sk-ant-1' })
    saveConfig({ apiKey: 'sk-openai-1', keyFor: 'openai' })
    expect(getApiKey()).toBe('sk-ant-1')
    expect(getApiKey('openai')).toBe('sk-openai-1')
    expect(getConfig()).toMatchObject({ provider: 'anthropic', hasKey: true, keys: { anthropic: 'saved', openai: 'saved' } })

    // Mistral chosen, with no key: Forgy cannot talk yet
    expect(saveConfig({ provider: 'mistral', providerModel: 'mistral-large-latest' })).toMatchObject({ provider: 'mistral', hasKey: false, keySource: null, providerModel: 'mistral-large-latest' })
    // Ollama needs none; each provider keeps its own model
    expect(saveConfig({ provider: 'ollama' })).toMatchObject({ hasKey: true, providerModel: '' })
    expect(saveConfig({ provider: 'mistral' }).providerModel).toBe('mistral-large-latest')
    // A custom server needs its address; a wrong one is refused
    expect(saveConfig({ provider: 'custom' }).hasKey).toBe(false)
    expect(() => saveConfig({ baseUrl: 'ftp://nope' })).toThrow('URL_INVALID')
    // Plain http only to this PC: a key would travel in clear to another machine
    expect(() => saveConfig({ baseUrl: 'http://192.168.1.20:8000/v1' })).toThrow('URL_HTTP_REMOTE')
    // « 127.0.0.1@ » is a user name before the real host: refused as such
    expect(() => saveConfig({ baseUrl: 'http://127.0.0.1@evil.example/v1' })).toThrow('URL_CREDENTIALS')
    // No name nor password in the address: they would be kept in clear
    expect(() => saveConfig({ baseUrl: 'https://user:token@llm.example.org/v1' })).toThrow('URL_CREDENTIALS')
    expect(saveConfig({ baseUrl: 'https://llm.example.org/v1' }).baseUrl).toBe('https://llm.example.org/v1')
    expect(saveConfig({ baseUrl: `${base}/` })).toMatchObject({ hasKey: true, baseUrl: base })

    // Removing one key leaves the other
    saveConfig({ clearKey: true, keyFor: 'openai' })
    expect(getApiKey('openai')).toBeNull()
    expect(getApiKey()).toBe('sk-ant-1')
  })

  it('never sends a known provider’s key to another address, even one written in the config file', () => {
    saveConfig({ provider: 'openai' })
    expect(() => saveConfig({ baseUrl: 'https://attacker.example/v1' })).toThrow('URL_FIXED')
    // A config file changed by hand (or by an old version): the address is not taken
    const path = join(userData(), 'assistant', 'config.json')
    const c = JSON.parse(readFileSync(path, 'utf-8'))
    writeFileSync(path, JSON.stringify({ ...c, baseUrls: { ...c.baseUrls, openai: 'https://attacker.example/v1', custom: 'http://203.0.113.5/v1' } }))
    expect(endpointOf('openai')).toBe('https://api.openai.com/v1')
    expect(getConfig().baseUrl).toBe('')
    // A custom address the file holds is checked again when read: plain http elsewhere is left out
    expect(endpointOf('custom')).toBe('')
  })

  it('Ollama may be on the local network over http, and never gets a key', () => {
    saveConfig({ provider: 'ollama' })
    expect(saveConfig({ baseUrl: 'http://192.168.1.20:11434/v1' }).baseUrl).toBe('http://192.168.1.20:11434/v1')
    expect(saveConfig({ baseUrl: 'http://nas.local:11434/v1' }).baseUrl).toBe('http://nas.local:11434/v1')
    expect(() => saveConfig({ baseUrl: 'http://203.0.113.5:11434/v1' })).toThrow('URL_HTTP_REMOTE_LAN')
    saveConfig({ apiKey: 'should-never-leave', keyFor: 'ollama' })
    expect(keyFor('ollama')).toBeNull()
    saveConfig({ clearKey: true, keyFor: 'ollama' })
    saveConfig({ baseUrl: '' })
    expect(endpointOf('ollama')).toBe('http://localhost:11434/v1')
  })

  it('an imported setup never brings a server address with it', () => {
    const dir = join(userData(), 'import-test')
    importConfig(dir, JSON.stringify({ app: 'DevForge', format: 1, files: { 'assistant/config.json': { provider: 'ollama', models: { ollama: 'llama3' }, baseUrls: { ollama: 'http://203.0.113.5:11434/v1' } } } }))
    const written = JSON.parse(readFileSync(join(dir, 'assistant', 'config.json'), 'utf-8'))
    expect(written).toEqual({ provider: 'ollama', models: { ollama: 'llama3' } })
  })

  it('reads a provider’s environment variable when no key is saved', () => {
    process.env.GROQ_API_KEY = 'gsk_env'
    try {
      expect(keyFor('groq')).toBe('gsk_env')
      expect(getConfig().keys.groq).toBe('env')
    } finally { delete process.env.GROQ_API_KEY }
  })

  it('a conversation naming an unknown provider talks to Anthropic, and an unknown provider gets no key', () => {
    const dir = join(userData(), 'assistant', 'conversations')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'conv-unknown-1.json'), JSON.stringify({ id: 'conv-unknown-1', title: 't', updatedAt: new Date().toISOString(), items: [], api: [], provider: 'xyz', model: 'm' }))
    expect(loadConversation('conv-unknown-1')?.provider).toBeUndefined()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    try {
      expect(keyFor('xyz' as never)).toBeNull()
    } finally { delete process.env.ANTHROPIC_API_KEY }
  })

  it('xAI (Grok) is reached at its own address, with XAI_API_KEY', () => {
    expect(endpointOf('xai')).toBe('https://api.x.ai/v1')
    process.env.XAI_API_KEY = 'xai-env'
    try {
      expect(keyFor('xai')).toBe('xai-env')
      expect(getConfig().keys.xai).toBe('env')
    } finally { delete process.env.XAI_API_KEY }
  })
})

describe('Forgy on another provider', () => {
  async function ask(text: string) {
    const events: AssistantEvent[] = []
    const done = new Promise<void>(resolve => setAssistantEmitter(e => { events.push(e); if (e.type === 'done') resolve() }))
    const id = await sendToAssistant({ text })
    await done
    return { id, events }
  }

  it('runs its tools and answers, the conversation tied to that provider and model, at no cost', async () => {
    saveProjects([{ name: 'Atelier', path: tempDir('atelier') }])
    saveConfig({ provider: 'custom', baseUrl: base, providerModel: 'llama-test' })
    server.script.push(
      { sse: [delta({ tool_calls: [{ index: 0, id: 'call_p', type: 'function', function: { name: 'list_projects', arguments: '{}' } }] }, 'tool_calls')] },
      { sse: [delta({ content: 'Tu as un projet : Atelier.' }, 'stop')] }
    )
    const { id, events } = await ask('Quels projets ?')
    expect(events.filter(e => e.type === 'text').map(e => (e as { delta: string }).delta).join('')).toBe('Tu as un projet : Atelier.')
    expect(events.some(e => e.type === 'tool' && e.name === 'list_projects')).toBe(true)
    // The second request carries the tool's result, answering its call (by DevForge's own id)
    const second = server.requests[1].body.messages as { role: string; tool_call_id?: string; content?: string; tool_calls?: { id: string }[] }[]
    const callId = second.find(m => m.role === 'assistant')!.tool_calls![0].id
    expect(callId).not.toBe('call_p')
    expect(second.find(m => m.role === 'tool')).toMatchObject({ tool_call_id: callId, content: expect.stringContaining('Atelier') })
    const conv = loadConversation(id)!
    expect(conv).toMatchObject({ provider: 'custom', model: 'llama-test', cost: 0 })
    expect(conv.items.map(i => i.kind)).toEqual(['user', 'tool', 'assistant'])
  })

  it('without a model, says to pick one; with a key refused, says so', async () => {
    saveConfig({ provider: 'custom', baseUrl: base, providerModel: '' })
    const none = await ask('Bonjour')
    expect(none.events.find(e => e.type === 'error')).toMatchObject({ code: 'other', message: expect.stringMatching(/model|modèle/) })
    saveConfig({ providerModel: 'llama-test' })
    server.script.push({ status: 401, body: { error: { message: 'bad key' } } })
    const refused = await ask('Bonjour')
    expect(refused.events.find(e => e.type === 'error')).toMatchObject({ code: 'auth' })
  })

  it('lists the models of the active endpoint', async () => {
    saveConfig({ provider: 'custom', baseUrl: base })
    server.script.push({ body: { data: [{ id: 'b' }, { id: 'a' }] } })
    expect(await providerModels('custom')).toEqual(['a', 'b'])
    await expect(providerModels('mistral')).rejects.toThrow(/No API key/)
    await expect(providerModels('nope')).rejects.toThrow(/Unknown provider/)
  })
})
