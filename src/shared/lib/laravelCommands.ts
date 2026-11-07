import type { LaravelCommand } from '../types'

/** A migration name artisan turns into a file name */
export const LARAVEL_MIGRATION_RE = /^[a-z0-9_]{1,80}$/

/**
 * Sail's commands, without its script: it only runs on macOS, Linux and WSL2,
 * and is a front for these docker compose calls (which run anywhere Docker
 * does). -T: no terminal behind DevForge's console.
 */
export const SAIL_SERVICE = 'laravel.test'
const inSail = (...args: string[]) => ({ exe: 'docker', args: ['compose', 'exec', '-T', '-u', 'sail', SAIL_SERVICE, ...args] })

/**
 * The command line behind each button of the Laravel workshop: the button
 * shows it, the main process runs it. `arg`: a migration name. With Sail,
 * PHP and Composer run in the app's container.
 */
export function laravelCommand(command: LaravelCommand, arg = '', sail = false): { exe: string; args: string[] } {
  const artisan = (...args: string[]) => sail ? inSail('php', 'artisan', ...args) : { exe: 'php', args: ['artisan', ...args] }
  switch (command) {
    case 'composer:install': return sail ? inSail('composer', 'install', '--no-interaction') : { exe: 'composer', args: ['install', '--no-interaction'] }
    case 'db:start':         return { exe: 'docker', args: ['compose', 'up', '-d', '--wait', ...(sail ? [] : ['database'])] }
    case 'sail:stop':        return { exe: 'docker', args: ['compose', 'stop'] }
    case 'make:migration': {
      if (!LARAVEL_MIGRATION_RE.test(arg)) throw new Error('BAD_NAME')
      return artisan('make:migration', arg)
    }
    case 'migrate':          return artisan('migrate', '--no-interaction')
    case 'migrate:rollback': return artisan('migrate:rollback', '--step=1', '--no-interaction')
    case 'install:api':      return artisan('install:api', '--without-migration-prompt', '--no-interaction')
    case 'seed':             return artisan('db:seed', '--class=DevForgeSeeder', '--no-interaction')
    // With Sail the app is served by its container
    case 'serve':            return sail ? { exe: 'docker', args: ['compose', 'up', '-d', '--wait'] } : artisan('serve')
    case 'optimize:clear':   return artisan('optimize:clear')
  }
  throw new Error('UNKNOWN_COMMAND')
}

export function laravelCommandLine(command: LaravelCommand, arg?: string, sail = false): string {
  try { const c = laravelCommand(command, arg, sail); return `${c.exe} ${c.args.join(' ')}` } catch { return '' }
}

/** A project that runs in Sail: its compose file has the laravel.test service */
export const isSailCompose = (compose: string) => new RegExp(`^\\s{2,4}${SAIL_SERVICE.replace('.', '\\.')}:\\s*$`, 'm').test(compose)
