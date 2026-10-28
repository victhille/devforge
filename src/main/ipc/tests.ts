import { ipcMain, type BrowserWindow } from 'electron'
import type { TestRunner } from '@shared/types'
import { detectRunners, lastRun, runTests, stopTests } from '../services/tests/testRunner'

/** v3.7: a project's tests */
const RUNNERS: TestRunner[] = ['vitest', 'jest', 'playwright', 'phpunit', 'pytest', 'go', 'cargo']
const runnerOf = (v: unknown): TestRunner => {
  if (!RUNNERS.includes(v as TestRunner)) throw new Error('Unknown test tool')
  return v as TestRunner
}

export function registerTestsHandlers(mainWindow: BrowserWindow): void {
  const send = (line: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('tests:output', line) }
  ipcMain.handle('tests:detect', (_e, path: unknown) => detectRunners(String(path ?? '')))
  ipcMain.handle('tests:run', (_e, path: unknown, runner: unknown, files: unknown) =>
    runTests(String(path ?? ''), runnerOf(runner), Array.isArray(files) ? files.map(String) : undefined, send))
  ipcMain.handle('tests:stop', () => stopTests())
  ipcMain.handle('tests:last', (_e, path: unknown, runner: unknown) => lastRun(String(path ?? ''), runnerOf(runner)))
}
