import { readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * End-to-end tests only: a fake model that answers with scripted messages
 * read from DEVFORGE_E2E_ASSISTANT_SCRIPT (a JSON array, one message per
 * request). Never active in the installed app.
 */
export function scriptedClient(): Anthropic | null {
  const file = process.env.DEVFORGE_E2E_ASSISTANT_SCRIPT
  if (!file || app.isPackaged) return null
  return {
    beta: {
      messages: {
        stream: () => {
          // Consumed from the file so each request takes the next message
          const script = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>[]
          const msg = script.shift() ?? { stop_reason: 'end_turn', content: [{ type: 'text', text: '(end of script)' }] }
          writeFileSync(file, JSON.stringify(script))
          const full: Record<string, unknown> = { model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 10 }, ...msg }
          return {
            on: (event: string, cb: (t: unknown) => void) => {
              if (event === 'text') for (const b of (full.content ?? []) as { type: string; text?: string }[]) if (b.type === 'text') cb(b.text)
            },
            finalMessage: async () => full
          }
        }
      }
    }
  } as unknown as Anthropic
}
