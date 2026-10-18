import { spawn } from 'child_process'
import { homedir } from 'os'
import type { AiToolId, AiToolInfo } from '@shared/types'
import { assertSafeDir, findExecutable, isInsideProject } from '../../lib/safe'

/**
 * Official AI coding tools installed on the PC. Launched as they are, in a
 * terminal: they run on the user's own subscription (Claude, ChatGPT, Google
 * account). DevForge never reads or reuses their login.
 */
const TOOLS: { id: AiToolId; name: string; command: string; installUrl: string }[] = [
  { id: 'claude-code', name: 'Claude Code', command: 'claude', installUrl: 'https://code.claude.com/docs' },
  { id: 'codex', name: 'Codex', command: 'codex', installUrl: 'https://github.com/openai/codex' },
  { id: 'antigravity', name: 'Antigravity', command: 'agy', installUrl: 'https://antigravity.google' },
  { id: 'gemini-cli', name: 'Gemini CLI', command: 'gemini', installUrl: 'https://github.com/google-gemini/gemini-cli' }
]

export async function listAiTools(): Promise<AiToolInfo[]> {
  return Promise.all(TOOLS.map(async t => ({
    id: t.id, name: t.name, command: t.command, installUrl: t.installUrl, installed: !!(await findExecutable(t.command))
  })))
}

/** Folder to start in: a saved project, or the home folder */
function startDir(dir: unknown): string {
  if (dir === null || dir === undefined || dir === '') return homedir()
  const safe = assertSafeDir(dir)
  if (!isInsideProject(safe)) throw new Error('Not a saved project')
  return safe
}

function trySpawn(cmd: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise(res => {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', cwd, windowsHide: false })
    child.once('error', () => res(false))
    child.once('spawn', () => { child.unref(); res(true) })
  })
}

/** Open a terminal in the folder running the tool (Windows Terminal, else PowerShell, else cmd) */
export async function launchAiTool(id: unknown, dir: unknown): Promise<void> {
  const tool = TOOLS.find(t => t.id === id)
  if (!tool) throw new Error('Unknown tool')
  const exe = await findExecutable(tool.command)
  if (!exe) throw new Error(`${tool.name} is not installed`)
  const cwd = startDir(dir)
  if (process.platform !== 'win32') {
    if (await trySpawn('x-terminal-emulator', ['-e', exe], cwd)) return
    throw new Error('No terminal found')
  }
  // The executable path comes from `where`, the folder from assertSafeDir: no user text in a command line
  if (await trySpawn('wt', ['-d', cwd, 'cmd', '/k', exe], cwd)) return
  const ps = `& '${exe.replace(/'/g, "''")}'`
  if (await trySpawn('pwsh', ['-NoExit', '-Command', ps], cwd)) return
  if (await trySpawn('powershell', ['-NoExit', '-Command', ps], cwd)) return
  spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', exe], { detached: true, stdio: 'ignore', cwd }).unref()
}
