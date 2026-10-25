import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ProjectCreationOptions, LogLine, CommandResult } from '@shared/types'
import { commandRunner } from '../system/commandRunner'
import { detectTool } from '../system/environmentDetector'
import { runSetup } from './projectSetup'

type LogCb = (log: LogLine) => void
type ResultCb = (result: CommandResult) => void

function info(onLog: LogCb, taskId: string, text: string): void {
  onLog({ taskId, type: 'info', text, timestamp: new Date().toISOString() })
}

function validateName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid project name "${name}". Use only letters, numbers, hyphens, and underscores.`)
  }
}

function validatePath(destination: string): void {
  if (!existsSync(destination)) {
    throw new Error(`Destination directory does not exist: ${destination}`)
  }
}

function checkNoConflict(destination: string, name: string): void {
  const target = join(destination, name)
  if (existsSync(target)) {
    throw new Error(`A folder named "${name}" already exists in ${destination}`)
  }
}

// ─── React (Vite) ─────────────────────────────────────────────────────────────

function createReactProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination, packageManager, typescript, installDeps } = options
  const pm = packageManager

  const template = typescript ? 'react-ts' : 'react'

  // npm create vite@latest <name> -- --template react-ts
  const pmExe = pm === 'npm' ? 'npm' : pm === 'pnpm' ? 'pnpm' : 'yarn'
  let args: string[]

  if (pm === 'npm') {
    args = ['create', 'vite@latest', name, '--', '--template', template]
  } else if (pm === 'pnpm') {
    args = ['create', 'vite@latest', name, '--', '--template', template]
  } else {
    args = ['create', 'vite', name, '--template', template]
  }

  const taskId = commandRunner.run({
    executable: pmExe,
    args,
    cwd: destination,
    onLog,
    onResult: (result) => {
      if (result.status === 'success' && installDeps) {
        // Chain: install dependencies
        const installArgs = pm === 'npm' ? ['install'] : pm === 'pnpm' ? ['install'] : []
        if (installArgs.length > 0) {
          info(onLog, taskId, 'Installing dependencies...')
          commandRunner.run({
            executable: pmExe,
            args: installArgs,
            cwd: join(destination, name),
            onLog,
            onResult
          })
        } else {
          onResult(result)
        }
      } else {
        onResult(result)
      }
    }
  })

  return taskId
}

// ─── Next.js ──────────────────────────────────────────────────────────────────

function createNextjsProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination, packageManager, typescript } = options
  const pm = packageManager
  const pmExe = pm === 'npm' ? 'npm' : pm === 'pnpm' ? 'pnpm' : 'yarn'

  // npm keeps the flags before "--" for itself: create-next-app would then ask its questions
  const flags = ['--yes', typescript ? '--ts' : '--js', `--use-${pm}`]
  const args =
    pm === 'npm'
      ? ['create', 'next-app@latest', name, '--', ...flags]
      : ['create', 'next-app', name, ...flags]

  return commandRunner.run({ executable: pmExe, args, cwd: destination, onLog, onResult })
}

// ─── Vue ──────────────────────────────────────────────────────────────────────

function createVueProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination, packageManager, typescript } = options
  const pm = packageManager
  const pmExe = pm === 'npm' ? 'npm' : pm === 'pnpm' ? 'pnpm' : 'yarn'
  const template = typescript ? 'vue-ts' : 'vue'

  const args =
    pm === 'npm'
      ? ['create', 'vite@latest', name, '--', '--template', template]
      : ['create', 'vite@latest', name, '--', '--template', template]

  return commandRunner.run({ executable: pmExe, args, cwd: destination, onLog, onResult })
}

// ─── Node.js ──────────────────────────────────────────────────────────────────

function createNodejsProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination } = options
  const projectPath = join(destination, name)

  try {
    mkdirSync(projectPath, { recursive: true })
  } catch (err) {
    throw new Error(`Could not create directory: ${String(err)}`, { cause: err })
  }

  info(onLog, 'init', `Creating directory: ${projectPath}`)

  return commandRunner.run({
    executable: 'npm',
    args: ['init', '-y'],
    cwd: projectPath,
    onLog,
    onResult
  })
}

// ─── Symfony ──────────────────────────────────────────────────────────────────

function createSymfonyProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination } = options

  // Check for symfony CLI first, fall back to composer
  const symfonyTool = detectTool('symfony_cli')

  if (symfonyTool?.status === 'detected') {
    return commandRunner.run({
      executable: 'symfony',
      args: ['new', name, '--webapp'],
      cwd: destination,
      onLog,
      onResult
    })
  }

  // Fallback: composer create-project
  return commandRunner.run({
    executable: 'composer',
    args: ['create-project', 'symfony/skeleton', name],
    cwd: destination,
    onLog,
    onResult
  })
}

// ─── Empty project ────────────────────────────────────────────────────────────

function createEmptyProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  const { name, destination } = options
  const projectPath = join(destination, name)

  try {
    mkdirSync(projectPath, { recursive: true })
    info(onLog, 'init', `Created directory: ${projectPath}`)
    onResult({ taskId: 'init', exitCode: 0, status: 'success' })
  } catch (err) {
    onLog({ taskId: 'init', type: 'error', text: `Could not create directory: ${String(err)}`, timestamp: new Date().toISOString() })
    onResult({ taskId: 'init', exitCode: 1, status: 'failed' })
  }

  return 'init'
}

// ─── Git init ─────────────────────────────────────────────────────────────────

export function initGit(projectPath: string, onLog: LogCb, onResult: ResultCb): string {
  return commandRunner.run({
    executable: 'git',
    args: ['init'],
    cwd: projectPath,
    onLog,
    onResult
  })
}

// ─── Library installer (chained after project creation) ───────────────────────

function withLibraryInstall(
  options: ProjectCreationOptions,
  taskId: string,
  onLog: LogCb,
  onResult: ResultCb,
  innerOnResult: ResultCb
): ResultCb {
  const { libraries = [], devLibraries = [], packageManager: pm, name, destination } = options
  const projPath = join(destination, name)
  const pmExe    = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm'

  const hasLibs    = libraries.length > 0
  const hasDevLibs = devLibraries.length > 0

  if (!hasLibs && !hasDevLibs) return innerOnResult

  return (result) => {
    if (result.status !== 'success') {
      innerOnResult(result)
      return
    }

    const installDev = () => {
      if (!hasDevLibs) { innerOnResult(result); return }
      info(onLog, taskId, `Installing ${devLibraries.length} dev package(s)...`)
      const devArgs = pm === 'yarn' ? ['add', '--dev', ...devLibraries] : ['install', '--save-dev', ...devLibraries]
      commandRunner.run({ executable: pmExe, args: devArgs, cwd: projPath, onLog, onResult: innerOnResult })
    }

    if (hasLibs) {
      info(onLog, taskId, `Installing ${libraries.length} package(s)...`)
      const args = pm === 'yarn' ? ['add', ...libraries] : ['install', '--save', ...libraries]
      commandRunner.run({ executable: pmExe, args, cwd: projPath, onLog, onResult: () => installDev() })
    } else {
      installDev()
    }
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function createProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  validateName(options.name)
  validatePath(options.destination)
  checkNoConflict(options.destination, options.name)

  // Chain: framework creation → libraries → DevForge setup (database, options, Git, GitHub)
  const taskId       = 'init'
  const projPath     = join(options.destination, options.name)
  const afterLibs: ResultCb = (result) => {
    if (result.status === 'success' && options.setup) runSetup(options, projPath, result.taskId, onLog, onResult)
    else onResult(result)
  }
  const wrappedResult = withLibraryInstall(options, taskId, onLog, onResult, afterLibs)

  switch (options.framework) {
    case 'react':
      return createReactProject(options, onLog, wrappedResult)
    case 'nextjs':
      return createNextjsProject(options, onLog, wrappedResult)
    case 'vue':
      return createVueProject(options, onLog, wrappedResult)
    case 'nodejs':
      return createNodejsProject(options, onLog, wrappedResult)
    case 'symfony':
      return createSymfonyProject(options, onLog, wrappedResult)
    case 'empty':
      return createEmptyProject(options, onLog, wrappedResult)
    default:
      throw new Error(`Unknown framework: ${options.framework}`)
  }
}
