import { killTreesSync } from '../../lib/killTree'
import { processManager } from '../stacks/processManager'
import { testsToKillOnQuit } from '../tests/testRunner'
import { commandRunner } from './commandRunner'

/**
 * When DevForge quits or restarts: every process it started (dev servers, log
 * follows, commands, tests) is killed with its children before this returns.
 * Done later, on Windows the shell alone would go and its children stay, orphaned.
 * One taskkill for all: one wait at most.
 */
export function stopAllProcessesNow(): void {
  killTreesSync([...processManager.toKillOnQuit(), ...commandRunner.toKillOnQuit(), ...testsToKillOnQuit()])
}
