import { execSync } from 'child_process'
import type { EnvironmentTool } from '@shared/types'
import { run } from '../../lib/exec'

interface ToolDef {
  id: string
  name: string
  command: string
  args: string[]
  required: boolean
  parseVersion: (output: string) => string
}

const TOOL_DEFINITIONS: ToolDef[] = [
  {
    id: 'node',
    name: 'Node.js',
    command: 'node',
    args: ['--version'],
    required: false,
    parseVersion: (o) => o.trim()
  },
  {
    id: 'npm',
    name: 'npm',
    command: 'npm',
    args: ['--version'],
    required: false,
    parseVersion: (o) => `v${o.trim()}`
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    required: false,
    parseVersion: (o) => `v${o.trim()}`
  },
  {
    id: 'yarn',
    name: 'Yarn',
    command: 'yarn',
    args: ['--version'],
    required: false,
    parseVersion: (o) => `v${o.trim()}`
  },
  {
    id: 'git',
    name: 'Git',
    command: 'git',
    args: ['--version'],
    required: false,
    parseVersion: (o) => {
      const m = o.match(/[\d.]+/)
      return m ? `v${m[0]}` : o.trim()
    }
  },
  {
    id: 'php',
    name: 'PHP',
    command: 'php',
    args: ['--version'],
    required: false,
    parseVersion: (o) => {
      const m = o.match(/PHP ([\d.]+)/)
      return m ? `v${m[1]}` : o.split('\n')[0].trim()
    }
  },
  {
    id: 'composer',
    name: 'Composer',
    command: 'composer',
    args: ['--version'],
    required: false,
    parseVersion: (o) => {
      const m = o.match(/Composer version ([\d.]+)/)
      return m ? `v${m[1]}` : o.split('\n')[0].trim()
    }
  },
  {
    id: 'symfony_cli',
    name: 'Symfony CLI',
    command: 'symfony',
    args: ['version'],
    required: false,
    parseVersion: (o) => {
      const m = o.match(/version ([\d.]+)/)
      return m ? `v${m[1]}` : o.split('\n')[0].trim()
    }
  },
  {
    id: 'docker',
    name: 'Docker',
    command: 'docker',
    args: ['--version'],
    required: false,
    parseVersion: (o) => {
      const m = o.match(/Docker version ([\d.]+)/)
      return m ? `v${m[1]}` : o.trim()
    }
  }
]

function toTool(def: ToolDef, output: string | null): EnvironmentTool {
  return {
    id: def.id,
    name: def.name,
    command: `${def.command} ${def.args.join(' ')}`,
    version: output === null ? null : def.parseVersion(output),
    status: output === null ? 'not_detected' : 'detected',
    required: def.required
  }
}

async function detect(def: ToolDef): Promise<EnvironmentTool> {
  try {
    return toTool(def, await run(`${def.command} ${def.args.join(' ')}`))
  } catch {
    return toTool(def, null)
  }
}

let cache: Promise<EnvironmentTool[]> | null = null

/**
 * All tools probed in parallel. Result is cached for the app session:
 * installed tools rarely change, pass `force` to re-detect (Refresh button).
 */
export function detectEnvironment(force = false): Promise<EnvironmentTool[]> {
  if (!cache || force) {
    cache = Promise.all(TOOL_DEFINITIONS.map(detect))
    cache.catch(() => { cache = null })
  }
  return cache
}

/** Sync probe of a single tool, used during project creation. */
export function detectTool(id: string): EnvironmentTool | null {
  const def = TOOL_DEFINITIONS.find(d => d.id === id)
  if (!def) return null
  try {
    const output = execSync(`${def.command} ${def.args.join(' ')}`, {
      timeout: 5000, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
    })
    return toTool(def, output)
  } catch {
    return toTool(def, null)
  }
}
