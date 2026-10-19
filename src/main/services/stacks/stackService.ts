import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
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

export function saveStack(stack: Stack): void {
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
      if (step.command && step.cwd) processManager.start(key(stackId, step.id), step.command, step.cwd)
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
