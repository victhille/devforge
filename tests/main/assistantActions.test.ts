import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
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
          return {
            on: (event: string, cb: (t: unknown) => void) => {
              if (event === 'text') for (const b of (msg.content ?? []) as { type: string; text?: string }[]) if (b.type === 'text') cb(b.text!)
            },
            finalMessage: async () => msg
          }
        }
      }
    }
  }
  return { default: Anthropic }
})

const { sendToAssistant, setAssistantEmitter, stopAssistant } = await import('../../src/main/services/assistant/assistantService')
const { saveConfig } = await import('../../src/main/services/assistant/assistantStorage')
const { checkSql, decideAction, listActions, undoAction, ACTION_TOOLS } = await import('../../src/main/services/assistant/assistantActions')

/** One question; each action card is answered by `onAction` (or left waiting) */
async function ask(text: string, onAction: (e: AssistantEvent & { type: 'action' }, conversationId: string) => void) {
  const events: AssistantEvent[] = []
  const done = new Promise<void>(resolve => setAssistantEmitter(e => {
    events.push(e)
    if (e.type === 'action' && !e.auto) onAction(e, e.conversationId)
    if (e.type === 'done') resolve()
  }))
  const id = await sendToAssistant({ text })
  await done
  return { id, events }
}

/** The tool_result the model got back for a tool call */
const resultOf = (callIndex: number, toolId: string) => {
  const messages = h.calls[callIndex].messages as { role: string; content: { type: string; tool_use_id?: string; content?: string; is_error?: boolean }[] }[]
  return messages.at(-1)!.content.find(b => b.tool_use_id === toolId)!
}

describe('SQL guard rails', () => {
  it.each([
    ['SELECT * FROM users', true],
    ['  select 1; ', true],
    ['WITH x AS (SELECT 1) SELECT * FROM x', true],
    ['PRAGMA table_info(users)', true],
    ["UPDATE users SET name = 'a;b' WHERE id = 1", false],
    ['DELETE FROM users WHERE id = 3', false],
    ['INSERT INTO users (name) VALUES (1)', false]
  ])('accepts %s', (sql, readOnly) => {
    expect(checkSql(sql).readOnly).toBe(readOnly)
  })

  it.each([
    'DROP TABLE users',
    'TRUNCATE users',
    'ALTER TABLE users DROP COLUMN name',
    'DELETE FROM users',
    'UPDATE users SET admin = 1',
    'SELECT 1; DROP TABLE users',
    "SELECT * INTO OUTFILE '/tmp/x' FROM users",
    'GRANT ALL ON db TO bob'
  ])('refuses %s', sql => {
    expect(() => checkSql(sql)).toThrow()
  })
})

describe('assistant actions', () => {
  let dir: string
  beforeEach(() => {
    h.calls.length = 0
    dir = tempDir('proj')
    writeFileSync(join(dir, '.env'), 'APP_ENV=dev\n')
    saveProjects([{ name: 'Shop', path: dir }])
    saveConfig({ actionMode: 'ask' })
  })

  const proposeEnv = (id: string, key = 'NEW_FLAG') => h.script.push(
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'env_add', input: { project: 'Shop', key, value: 'on' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ok.' }] }
  )

  it('offers its action tools to the model', async () => {
    proposeEnv('a0')
    await ask('ajoute NEW_FLAG', e => decideAction(e.id, false))
    const names = (h.calls[0].tools as { name: string }[]).map(t => t.name)
    for (const t of ACTION_TOOLS) expect(names).toContain(t.name)
  })

  it('runs an approved action, journals it and can undo it', async () => {
    proposeEnv('a1')
    const { events } = await ask('ajoute NEW_FLAG', e => decideAction(e.id, true))

    const card = events.find(e => e.type === 'action') as AssistantEvent & { type: 'action' }
    expect(card).toMatchObject({ title: 'Add NEW_FLAG · Shop', reversible: true, auto: false })
    // The value is masked in the card
    expect(card.preview).not.toContain('on\n')
    expect(card.preview).toMatch(/NEW_FLAG=•+/)
    expect(events.find(e => e.type === 'action-done')).toMatchObject({ status: 'done' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toContain('NEW_FLAG=on')
    expect(resultOf(1, 'a1').content).toMatch(/^Done\./)

    const entry = listActions().find(a => a.id === 'a1')!
    expect(entry).toMatchObject({ status: 'done', canUndo: true, kind: 'env_add' })
    const undone = await undoAction('a1')
    expect(undone).toMatchObject({ status: 'undone', canUndo: false })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).not.toContain('NEW_FLAG')
    await expect(undoAction('a1')).rejects.toThrow()
  })

  it('does nothing when the user refuses, and tells the model', async () => {
    proposeEnv('a2')
    const { events } = await ask('ajoute NEW_FLAG', e => decideAction(e.id, false))
    expect(events.find(e => e.type === 'action-done')).toMatchObject({ status: 'refused' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).not.toContain('NEW_FLAG')
    expect(resultOf(1, 'a2').content).toMatch(/refused/)
    expect(listActions().find(a => a.id === 'a2')).toMatchObject({ status: 'refused', canUndo: false })
  })

  it('runs a safe action without a click in auto-safe mode', async () => {
    saveConfig({ actionMode: 'auto-safe' })
    proposeEnv('a3')
    const { events } = await ask('ajoute NEW_FLAG', () => { throw new Error('no card expected to wait') })
    expect(events.find(e => e.type === 'action')).toMatchObject({ auto: true })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toContain('NEW_FLAG=on')
    expect(listActions().find(a => a.id === 'a3')).toMatchObject({ auto: true, status: 'done' })
  })

  it('never changes an existing key', async () => {
    proposeEnv('a4', 'APP_ENV')
    const { events } = await ask('change APP_ENV', e => decideAction(e.id, true))
    expect(events.some(e => e.type === 'action')).toBe(false)
    expect(resultOf(1, 'a4')).toMatchObject({ is_error: true })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('APP_ENV=dev\n')
  })

  it('refuses a dangerous SQL request before showing anything', async () => {
    h.script.push(
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 's1', name: 'sql_execute', input: { connection: 'nope', sql: 'DROP TABLE users' } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ok.' }] }
    )
    const { events } = await ask('vide la base', e => decideAction(e.id, true))
    expect(events.some(e => e.type === 'action')).toBe(false)
    expect(resultOf(1, 's1')).toMatchObject({ is_error: true })
  })

  it('commits the changed files, then undoes the commit keeping the changes', async () => {
    const repo = tempDir('repo')
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf-8' })
    git('init', '-q'); git('config', 'user.name', 't'); git('config', 'user.email', 't@t')
    writeFileSync(join(repo, 'a.txt'), 'one\n'); git('add', '.'); git('commit', '-qm', 'first')
    writeFileSync(join(repo, 'a.txt'), 'two\n'); writeFileSync(join(repo, 'b.txt'), 'new\n')
    saveProjects([{ name: 'Repo', path: repo }])
    h.script.push(
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'g1', name: 'git_commit', input: { project: 'Repo', message: 'feat: two' } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ok.' }] }
    )
    const { events } = await ask('commit', e => decideAction(e.id, true))
    expect((events.find(e => e.type === 'action') as AssistantEvent & { type: 'action' }).preview).toMatch(/feat: two[\s\S]*a\.txt[\s\S]*b\.txt/)
    expect(git('log', '--format=%s')).toBe('feat: two\nfirst\n')
    expect(git('status', '--porcelain')).toBe('')

    await undoAction('g1')
    expect(git('log', '--format=%s')).toBe('first\n')
    // Changes are back, staged
    expect(git('status', '--porcelain')).toMatch(/M {2}a\.txt[\s\S]*A {2}b\.txt/)
  })

  it('counts a stopped answer as a refusal', async () => {
    proposeEnv('a5')
    const { events } = await ask('ajoute NEW_FLAG', (_e, conversationId) => stopAssistant(conversationId))
    expect(events.find(e => e.type === 'action-done')).toMatchObject({ status: 'refused' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).not.toContain('NEW_FLAG')
  })
})
