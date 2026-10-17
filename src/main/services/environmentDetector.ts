import { execSync } from 'child_process'
import type { EnvironmentTool } from '../../shared/types'

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

function detect(def: ToolDef): EnvironmentTool {
  try {
    const output = execSync(`${def.command} ${def.args.join(' ')}`, {
      timeout: 5000,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return {
      id: def.id,
      name: def.name,
      command: `${def.command} ${def.args.join(' ')}`,
      version: def.parseVersion(output),
      status: 'detected',
      required: def.required
    }
  } catch {
    return {
      id: def.id,
      name: def.name,
      command: `${def.command} ${def.args.join(' ')}`,
      version: null,
      status: 'not_detected',
      required: def.required
    }
  }
}

export function detectEnvironment(): EnvironmentTool[] {
  return TOOL_DEFINITIONS.map(detect)
}

export function detectTool(id: string): EnvironmentTool | null {
  const def = TOOL_DEFINITIONS.find(d => d.id === id)
  if (!def) return null
  return detect(def)
}
