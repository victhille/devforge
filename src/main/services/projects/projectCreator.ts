import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ProjectCreationOptions, LogLine, CommandResult } from '@shared/types'
import { commandRunner } from '../system/commandRunner'
import { detectTool } from '../system/environmentDetector'
import { runSetup } from './projectSetup'
import { packageName } from '@shared/data/projectLibraries'
import { extractTemplate } from './userTemplates'
import { managerOf } from '@shared/lib/packageManagers'
import { isPackageSpec } from '@shared/lib/packages'
import { DB_NAME_RE, REPO_RE, SETUP_FEATURES } from '@shared/lib/projectSetup'
import type { SetupDatabase } from '@shared/types'
import { API_URL_RE } from '@shared/lib/spaAuthTemplate'

type LogCb = (log: LogLine) => void
type ResultCb = (result: CommandResult) => void

/** The creator's own messages, in the interface's language */
const TEXT = {
  fr: {
    install: 'Installation des dépendances…', mkdir: (p: string) => `Création du dossier : ${p}`, made: (p: string) => `Dossier créé : ${p}`,
    libs: (n: number) => `Installation de ${n} paquet(s)…`, devLibs: (n: number) => `Installation de ${n} paquet(s) de développement…`
  },
  en: {
    install: 'Installing dependencies…', mkdir: (p: string) => `Creating directory: ${p}`, made: (p: string) => `Created directory: ${p}`,
    libs: (n: number) => `Installing ${n} package(s)…`, devLibs: (n: number) => `Installing ${n} dev package(s)…`
  }
}
const text = (o: ProjectCreationOptions) => TEXT[o.lang ?? 'fr']

function info(onLog: LogCb, taskId: string, text: string): void {
  onLog({ taskId, type: 'info', text, timestamp: new Date().toISOString() })
}

function validateName(name: string): void {
  // Passed to npm create, composer create-project, symfony new: never read as an option
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(`Invalid project name "${name}". Use only letters, numbers, hyphens, and underscores.`)
  }
}

/**
 * The libraries and the GitHub repository go into commands run through a shell: only what the
 * window's own checks let through (the library catalog, REPO_RE), whatever a window or a template sent
 */
function validateCommandInputs(options: ProjectCreationOptions): void {
  for (const list of [options.libraries, options.devLibraries]) {
    if (list === undefined) continue
    if (!Array.isArray(list)) throw new Error('Invalid library list')
    for (const spec of list) if (!isPackageSpec(spec)) throw new Error(`Invalid library "${String(spec)}"`)
  }
  const s = options.setup
  if (!s) return
  const repo = s.github?.repo
  if (s.github && (typeof repo !== 'string' || !REPO_RE.test(repo))) {
    throw new Error(`Invalid GitHub repository "${String(repo)}"`)
  }
  // Written into compose.yaml (started at once), the .env files and the welcome page
  if (!SETUP_DATABASES.includes(s.database)) throw new Error(`Invalid database "${String(s.database)}"`)
  if (s.database === 'postgres' || s.database === 'mysql') {
    if (typeof s.dbName !== 'string' || !DB_NAME_RE.test(s.dbName)) throw new Error(`Invalid database name "${String(s.dbName)}"`)
    if (!isPort(s.dbPort)) throw new Error(`Invalid database port "${String(s.dbPort)}"`)
  }
  if (s.appPort !== undefined && !isPort(s.appPort)) throw new Error(`Invalid app port "${String(s.appPort)}"`)
  if (!Array.isArray(s.features) || s.features.some(f => !SETUP_FEATURES.includes(f))) throw new Error('Invalid project features')
  if (s.apiUrl !== undefined && (typeof s.apiUrl !== 'string' || !API_URL_RE.test(s.apiUrl))) throw new Error('Invalid API address')
}

const SETUP_DATABASES: readonly SetupDatabase[] = ['none', 'postgres', 'mysql', 'sqlite']
const isPort = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 65535

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
    args = ['create', '--yes', 'vite@latest', name, '--', '--template', template]
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
          info(onLog, taskId, text(options).install)
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
  // DevForge makes the repository itself (branch main, its .gitignore first): create-next-app's would be on master
  if (options.setup?.git || options.setup?.github) flags.push('--disable-git')
  const args =
    pm === 'npm'
      ? ['create', '--yes', 'next-app@latest', name, '--', ...flags]
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
      ? ['create', '--yes', 'vite@latest', name, '--', '--template', template]
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

  info(onLog, 'init', text(options).mkdir(projectPath))

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
    // DevForge makes the repository itself (branch main, its .gitignore first): the CLI's would be on master.
    // The CLI refuses --webapp without Git, so then the skeleton, as with Composer: the next steps add what is needed
    const ownGit = options.setup?.git || options.setup?.github
    return commandRunner.run({
      executable: 'symfony',
      args: ['new', name, ...(ownGit ? ['--no-git'] : ['--webapp'])],
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

// ─── Laravel ──────────────────────────────────────────────────────────────────

function createLaravelProject(
  options: ProjectCreationOptions,
  onLog: LogCb,
  onResult: ResultCb
): string {
  return commandRunner.run({
    executable: 'composer',
    args: ['create-project', 'laravel/laravel', options.name, '--no-interaction', '--prefer-dist'],
    cwd: options.destination,
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
    info(onLog, 'init', text(options).made(projectPath))
    onResult({ taskId: 'init', exitCode: 0, status: 'success' })
  } catch (err) {
    onLog({ taskId: 'init', type: 'error', text: `Could not create directory: ${String(err)}`, timestamp: new Date().toISOString() })
    onResult({ taskId: 'init', exitCode: 1, status: 'failed' })
  }

  return 'init'
}

// ─── One of the user's templates (v3.8) ───────────────────────────────────────

function createFromTemplate(options: ProjectCreationOptions, onLog: LogCb, onResult: ResultCb): string {
  const projectPath = join(options.destination, options.name)
  const fr = (options.lang ?? 'fr') === 'fr'
  mkdirSync(projectPath, { recursive: true })
  info(onLog, 'init', text(options).made(projectPath))
  extractTemplate(options.template!, projectPath, options.name)
    .then(n => {
      info(onLog, 'init', fr ? `Modèle copié : ${n} fichier(s), le nom du projet remplacé` : `Template copied: ${n} file(s), the project's name replaced`)
      onResult({ taskId: 'init', exitCode: 0, status: 'success' })
    })
    .catch(err => {
      onLog({ taskId: 'init', type: 'error', text: String(err instanceof Error ? err.message : err), timestamp: new Date().toISOString() })
      onResult({ taskId: 'init', exitCode: 1, status: 'failed' })
    })
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

/** Packages the new project's package.json already declares (create-next-app brings Tailwind) */
function declaredPackages(projPath: string): Set<string> {
  try {
    const pkg = JSON.parse(readFileSync(join(projPath, 'package.json'), 'utf-8')) as { dependencies?: object; devDependencies?: object }
    return new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
  } catch {
    return new Set()
  }
}

function withLibraryInstall(
  options: ProjectCreationOptions,
  taskId: string,
  onLog: LogCb,
  onResult: ResultCb,
  innerOnResult: ResultCb
): ResultCb {
  const { packageManager: pm, name, destination } = options
  const projPath = join(destination, name)
  const pmExe    = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm'

  if (!options.libraries?.length && !options.devLibraries?.length) return innerOnResult

  return (result) => {
    if (result.status !== 'success') {
      innerOnResult(result)
      return
    }
    const declared     = declaredPackages(projPath)
    const libraries    = (options.libraries ?? []).filter(p => !declared.has(packageName(p)))
    const devLibraries = (options.devLibraries ?? []).filter(p => !declared.has(packageName(p)))
    const hasLibs      = libraries.length > 0
    const hasDevLibs   = devLibraries.length > 0

    const installDev = () => {
      if (!hasDevLibs) { innerOnResult(result); return }
      info(onLog, taskId, text(options).devLibs(devLibraries.length))
      const devArgs = pm === 'yarn' ? ['add', '--dev', ...devLibraries] : ['install', '--save-dev', ...devLibraries]
      commandRunner.run({ executable: pmExe, args: devArgs, cwd: projPath, onLog, onResult: innerOnResult })
    }

    if (hasLibs) {
      info(onLog, taskId, text(options).libs(libraries.length))
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
  // The package manager goes into the commands (--use-pnpm…): a known one only, whatever the window or a template sent
  // Its language picks the messages and the generated pages' texts: fr or en, nothing else
  options = { ...options, packageManager: managerOf(options.packageManager), lang: options.lang === 'en' ? 'en' : 'fr' }
  validateName(options.name)
  validateCommandInputs(options)
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
  if (options.template) return createFromTemplate(options, onLog, wrappedResult)

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
    case 'laravel':
      return createLaravelProject(options, onLog, wrappedResult)
    case 'empty':
      return createEmptyProject(options, onLog, wrappedResult)
    default:
      throw new Error(`Unknown framework: ${options.framework}`)
  }
}
