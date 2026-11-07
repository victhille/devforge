import { existsSync, readFileSync, mkdirSync, statSync } from 'fs'
import { join, dirname, isAbsolute } from 'path'
import { app, shell } from 'electron'
import type { Stack, StackStep } from '@shared/types'
import { processManager } from './processManager'
import { assertSafeDir, launch } from '../../lib/safe'
import { writeJsonFile } from '../../lib/jsonFile'

function storagePath(): string {
  return join(app.getPath('userData'), 'stacks.json')
}

export function loadStacks(): Stack[] {
  const path = storagePath()
  if (!existsSync(path)) return []
  try { return JSON.parse(readFileSync(path, 'utf-8')) as Stack[] } catch { return [] }
}

function persist(stacks: Stack[]): void {
  const path = storagePath()
  mkdirSync(dirname(path), { recursive: true })
  writeJsonFile(path, stacks)
}

const STEP_TYPES = new Set(['command', 'vscode', 'url'])
const optString = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length <= max)

/** v4.0: what the window sends is checked before it is kept (and run later) */
export function assertStack(stack: unknown): Stack {
  const s = stack as Stack
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !Array.isArray(s.steps)) throw new Error('Invalid stack')
  for (const step of s.steps) {
    if (!step || typeof step.id !== 'string' || !STEP_TYPES.has(step.type) || typeof step.label !== 'string'
      || !optString(step.command, 4000) || !optString(step.cwd, 1000) || !optString(step.url, 2000)
      || (step.delayMs !== undefined && (!Number.isInteger(step.delayMs) || step.delayMs < 0 || step.delayMs > 60_000))) throw new Error('Invalid stack step')
  }
  return s
}

export function saveStack(input: Stack): void {
  const stack = assertStack(input)
  const stacks = loadStacks()
  const i = stacks.findIndex(s => s.id === stack.id)
  if (i >= 0) stacks[i] = stack; else stacks.push(stack)
  persist(stacks)
}

export async function removeStack(id: string): Promise<void> {
  await processManager.stopAll(`${id}:`)
  persist(loadStacks().filter(s => s.id !== id))
}

const key = (stackId: string, stepId: string) => `${stackId}:${stepId}`

function findStep(stackId: string, stepId: string): StackStep {
  const step = loadStacks().find(s => s.id === stackId)?.steps.find(s => s.id === stepId)
  if (!step) throw new Error('Unknown step')
  return step
}

async function runStep(stackId: string, step: StackStep): Promise<void> {
  switch (step.type) {
    case 'command':
      // The command is the user's own (a shell line, on purpose); the folder must exist
      if (step.command && step.cwd) {
        if (!isAbsolute(step.cwd) || !existsSync(step.cwd) || !statSync(step.cwd).isDirectory()) throw new Error(`Not a folder: ${step.cwd}`)
        processManager.start(key(stackId, step.id), step.command, step.cwd)
      }
      break
    case 'vscode':
      if (step.cwd) await launch('code', [assertSafeDir(step.cwd)])
      break
    case 'url':
      if (step.url && /^https?:\/\//i.test(step.url)) {
        const url = step.url
        setTimeout(() => shell.openExternal(url), step.delayMs ?? 0)
      }
      break
  }
}

export async function startStack(id: string): Promise<void> {
  const stack = loadStacks().find(s => s.id === id)
  if (!stack) throw new Error('Unknown stack')
  for (const step of stack.steps) await runStep(id, step)
}

export const stopStack = (id: string) => processManager.stopAll(`${id}:`)

export const startStep = (stackId: string, stepId: string) => runStep(stackId, findStep(stackId, stepId))
export const stopStep  = (stackId: string, stepId: string) => processManager.stop(key(stackId, stepId))
