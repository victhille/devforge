import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantEvent } from '@shared/types'
import { saveProjects, tempDir } from '../helpers'

// Fake SDK: each stream() call returns the next scripted message
const h = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], script: [] as Record<string, unknown>[] }))

vi.mock('@anthropic-ai/sdk', () => {
  class AnthropicError extends Error {}
  class APIError extends AnthropicError { status?: number }
  class APIUserAbortError extends AnthropicError {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    static AnthropicError = AnthropicError
    static APIError = APIError
    static APIUserAbortError = APIUserAbortError
    static AuthenticationError = AuthenticationError
    static RateLimitError = RateLimitError
    static APIConnectionError = APIConnectionError
    beta = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          h.calls.push(JSON.parse(JSON.stringify(params)))
          const msg = h.script.shift()!
          if (msg.throw) throw msg.throw
          return {
            on: (event: string, cb: (t: string) => void) => {
              if (event === 'text') for (const b of (msg.content ?? []) as { type: string; text?: string }[]) if (b.type === 'text') cb(b.text!)
            },
            finalMessage: async () => { if (msg.rejectFinal) throw msg.rejectFinal; return msg }
          }
        }
      }
    }
  }
  return { default: Anthropic }
})

const { sendToAssistant, setAssistantEmitter } = await import('../../src/main/services/assistant/assistantService')
const { loadConversation } = await import('../../src/main/services/assistant/assistantStorage')

async function ask(text: string, extra: Record<string, unknown> = {}) {
  const events: AssistantEvent[] = []
  const done = new Promise<void>(resolve => setAssistantEmitter(e => { events.push(e); if (e.type === 'done') resolve() }))
  const id = await sendToAssistant({ text, ...extra })
  await done
  return { id, events }
}

describe('assistant loop', () => {
  let dir: string
  beforeEach(() => {
    h.calls.length = 0
    dir = tempDir('proj')
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'a.ts'), 'export const hello = "bonjour"\n')
    writeFileSync(join(dir, '.env'), 'TOKEN=secret-value\n')
    saveProjects([{ name: 'Shop', path: dir }])
  })

  it('streams text, runs tools, sends results back and keeps an append-only history', async () => {
    h.script.push(
      { stop_reason: 'tool_use', content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: 'Je regarde. ' },
        { type: 'tool_use', id: 't1', name: 'read_file', input: { project: 'Shop', path: 'src/a.ts' } },
        { type: 'tool_use', id: 't2', name: 'read_file', input: { project: 'Shop', path: '.env' } }
      ] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Le fichier exporte **hello**.' }] }
    )
    const { id, events } = await ask('Que fait a.ts ?', { projectPath: dir, pageContext: { label: 'API Tester — GET x', content: 'status 200' } })

    // Request shape
    const first = h.calls[0] as Record<string, unknown>
    // Free question in auto mode: Sonnet 5.5 at low effort
    expect(first).toMatchObject({
      model: 'claude-sonnet-5-5', max_tokens: 16000, output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' }, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01']
    })
    // Explicit breakpoint on the static system text, skill instructions after it
    const system = first.system as { text: string; cache_control?: unknown }[]
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[1].cache_control).toBeUndefined()
    const userBlocks = (first.messages as { content: { text: string }[] }[])[0].content
    expect(userBlocks[0].text).toMatch(/^<project_context>\nProject: Shop/)
    expect(userBlocks[1].text).toContain('<page_context label="API Tester — GET x">')
    expect(userBlocks[2].text).toBe('Que fait a.ts ?')

    // Tool results: one user message, file content in, secret refused
    const second = (h.calls[1].messages as { role: string; content: unknown }[])
    expect(second).toHaveLength(3)
    expect(second[1].content).toEqual(first.messages ? expect.arrayContaining([expect.objectContaining({ type: 'thinking', signature: 'sig' })]) : null)
    const results = second[2].content as { tool_use_id: string; content: string; is_error?: boolean }[]
    expect(results.map(r => r.tool_use_id)).toEqual(['t1', 't2'])
    expect(results[0].content).toContain('bonjour')
    expect(results[1].is_error).toBe(true)
    expect(JSON.stringify(h.calls)).not.toContain('secret-value')

    // Events and saved conversation
    expect(events.filter(e => e.type === 'text').map(e => (e as { delta: string }).delta).join('')).toBe('Je regarde. Le fichier exporte **hello**.')
    // Tools run in parallel: compare by id, not by finishing order
    const done = Object.fromEntries(events.filter(e => e.type === 'tool-done').map(e => [(e as { id: string }).id, (e as { ok: boolean }).ok]))
    expect(done).toEqual({ t1: true, t2: false })
    const conv = loadConversation(id)!
    expect(conv.items.map(i => i.kind)).toEqual(['user', 'assistant', 'tool', 'tool', 'assistant'])
    expect(conv.items[0]).toMatchObject({ kind: 'user', context: ['Shop', 'API Tester — GET x'] })
    expect(conv.api.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  it('gives the project context once per conversation', async () => {
    h.script.push({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] })
    const { id } = await ask('Q1', { projectPath: dir })
    await ask('Q2', { conversationId: id, projectPath: dir })
    const last = h.calls[1].messages as { role: string; content: { text: string }[] }[]
    expect(last.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(last[2].content).toEqual([{ type: 'text', text: 'Q2' }])
  })

  it('reports refusals and API errors as notices', async () => {
    h.script.push({ stop_reason: 'refusal', content: [] })
    const { id, events } = await ask('x')
    expect(events.some(e => e.type === 'error' && e.code === 'refusal')).toBe(true)
    expect(loadConversation(id)!.items.at(-1)).toMatchObject({ kind: 'notice', tone: 'error' })

    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as { AuthenticationError: new (m: string) => Error }
    h.script.push({ throw: new Anthropic.AuthenticationError('bad key') })
    const r = await ask('y')
    expect(r.events.some(e => e.type === 'error' && e.code === 'auth')).toBe(true)
  })

  it('without any credentials, says to add a key instead of failing silently', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as { AnthropicError: new (m: string) => Error }
    h.script.push({ rejectFinal: new Anthropic.AnthropicError('Could not resolve authentication method. Expected one of apiKey…') })
    const { events } = await ask('x')
    expect(events.filter(e => e.type === 'error').map(e => (e as { code: string }).code)).toEqual(['no-key'])
    expect(h.script).toHaveLength(0)
  })

  it('retries an unparseable tool input twice at most, then reports it', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as { AnthropicError: new (m: string) => Error }
    const bad = () => ({ rejectFinal: new Anthropic.AnthropicError('Unable to parse tool parameter JSON from model.') })
    h.script.push(bad(), bad(), bad())
    const { events } = await ask('y')
    expect(h.calls).toHaveLength(3)
    expect(events.some(e => e.type === 'error' && e.code === 'other')).toBe(true)
  })

  it('does not run the tools of a truncated turn', async () => {
    h.script.push({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 't9', name: 'read_file', input: { project: 'Shop' } }] })
    const { id, events } = await ask('z')
    expect(events.some(e => e.type === 'tool')).toBe(false)
    expect(events.some(e => e.type === 'error' && e.code === 'truncated')).toBe(true)
    // No dangling tool_use in the saved history
    expect(loadConversation(id)!.api.map(m => m.role)).toEqual(['user'])
  })

  it('a skill picks its model and effort, kept for the whole conversation', async () => {
    const msg = { stop_reason: 'end_turn', model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 } }
    h.script.push({ ...msg }, { ...msg })
    const { id } = await ask('Explique ce projet', { skill: 'explain-project', projectPath: dir })
    expect(h.calls[0]).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } })
    // Haiku has no server-side fallback
    expect(h.calls[0].fallbacks).toBeUndefined()
    expect((h.calls[0].system as { text: string }[])[1].text).toMatch(/présenter le projet|present the project/)
    // Second question: same model even if another skill is asked
    await ask('Et ensuite ?', { conversationId: id, skill: 'review-changes' })
    expect(h.calls[1]).toMatchObject({ model: 'claude-haiku-5-5' })
  })

  it('counts the cost of each response and stops at the monthly budget', async () => {
    const { costOf } = await import('../../src/shared/data/assistantSkills')
    const { saveConfig, monthUsage } = await import('../../src/main/services/assistant/assistantStorage')
    const usage = { input_tokens: 2000, output_tokens: 500, cache_read_input_tokens: 10000, cache_creation_input_tokens: 1000 }
    h.script.push({ stop_reason: 'end_turn', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'ok' }], usage })
    const before = monthUsage().spent
    const { id } = await ask('Combien ?')
    const expected = costOf('claude-sonnet-5-5', { input: 2000, output: 500, cacheRead: 10000, cacheWrite: 1000 })
    // 2000×2 + 500×10 + 10000×0.2 + 1000×2.5 per million = 0.0135 $
    expect(expected).toBeCloseTo(0.0135, 6)
    const conv = loadConversation(id)!
    expect(conv.cost).toBeCloseTo(expected, 6)
    expect(conv.lastInput).toBe(13000)
    expect(monthUsage().spent - before).toBeCloseTo(expected, 6)

    // Budget already spent: no request at all
    saveConfig({ monthlyBudget: 0.01 })
    const calls = h.calls.length
    const r = await ask('Encore ?')
    expect(h.calls.length).toBe(calls)
    expect(r.events.some(e => e.type === 'error' && e.code === 'budget')).toBe(true)
    saveConfig({ monthlyBudget: 0 })
  })

  it('caps the tool rounds of one question', async () => {
    for (let i = 0; i < 8; i++) h.script.push({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `t${i}`, name: 'list_projects', input: {} }] })
    const { events } = await ask('Boucle')
    expect(h.calls).toHaveLength(8)
    expect(events.some(e => e.type === 'error' && e.code === 'limit')).toBe(true)
  })
})
