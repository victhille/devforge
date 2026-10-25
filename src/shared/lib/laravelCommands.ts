import type { LaravelCommand } from '../types'

/** A migration name artisan turns into a file name */
export const LARAVEL_MIGRATION_RE = /^[a-z0-9_]{1,80}$/

/**
 * The command line behind each button of the Laravel workshop: the button
 * shows it, the main process runs it. `arg`: a migration name.
 */
export function laravelCommand(command: LaravelCommand, arg = ''): { exe: string; args: string[] } {
  const artisan = (...args: string[]) => ({ exe: 'php', args: ['artisan', ...args] })
  switch (command) {
    case 'composer:install': return { exe: 'composer', args: ['install', '--no-interaction'] }
    case 'db:start':         return { exe: 'docker', args: ['compose', 'up', '-d', '--wait', 'database'] }
    case 'make:migration': {
      if (!LARAVEL_MIGRATION_RE.test(arg)) throw new Error('BAD_NAME')
      return artisan('make:migration', arg)
    }
    case 'migrate':          return artisan('migrate', '--no-interaction')
    case 'migrate:rollback': return artisan('migrate:rollback', '--step=1', '--no-interaction')
    case 'install:api':      return artisan('install:api', '--without-migration-prompt', '--no-interaction')
    case 'seed':             return artisan('db:seed', '--class=DevForgeSeeder', '--no-interaction')
    case 'serve':            return artisan('serve')
    case 'optimize:clear':   return artisan('optimize:clear')
  }
  throw new Error('UNKNOWN_COMMAND')
}

export function laravelCommandLine(command: LaravelCommand, arg?: string): string {
  try { const c = laravelCommand(command, arg); return `${c.exe} ${c.args.join(' ')}` } catch { return '' }
}
