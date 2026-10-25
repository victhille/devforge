import type { NextCommand } from '../types'
import { pmAdd } from './projectSetup'

type PM = 'npm' | 'pnpm' | 'yarn'

/** Prisma 7 talks to the database through a driver adapter */
export const ADAPTER: Record<string, { pkg: string; cls: string }> = {
  postgresql: { pkg: '@prisma/adapter-pg', cls: 'PrismaPg' },
  mysql: { pkg: '@prisma/adapter-mariadb', cls: 'PrismaMariaDb' },
  sqlite: { pkg: '@prisma/adapter-better-sqlite3', cls: 'PrismaBetterSqlite3' }
}

/** A migration name Prisma accepts in a folder name */
export const MIGRATION_RE = /^[a-z0-9_]{1,60}$/

/**
 * The command line behind each button of the Next.js workshop: the button
 * shows it, the main process runs it. `arg`: a migration name, or the
 * database provider for install:client.
 */
export function nextCommand(command: NextCommand, pm: PM, arg = ''): { exe: string; args: string[] } {
  // Prisma 7 no longer generates the client after a migration or an install: done right after
  const generate = ['&&', 'npx', 'prisma', 'generate']
  switch (command) {
    case 'db:start':        return { exe: 'docker', args: ['compose', 'up', '-d', '--wait', 'database'] }
    // Written, not run: its SQL is read before "apply"
    case 'prisma:migrate': {
      if (!MIGRATION_RE.test(arg)) throw new Error('BAD_NAME')
      return { exe: 'npx', args: ['prisma', 'migrate', 'dev', '--create-only', '--name', arg] }
    }
    case 'prisma:deploy':   return { exe: 'npx', args: ['prisma', 'migrate', 'deploy', ...generate] }
    case 'prisma:generate': return { exe: 'npx', args: ['prisma', 'generate'] }
    case 'prisma:studio':   return { exe: 'npx', args: ['prisma', 'studio'] }
    case 'install:prisma':  return { exe: pm, args: pmAdd(pm, ['prisma', 'dotenv'], true) }
    case 'install:client':  return { exe: pm, args: [...pmAdd(pm, ['@prisma/client', ...(ADAPTER[arg] ? [ADAPTER[arg].pkg] : [])]), ...generate] }
    case 'install:seed':    return { exe: pm, args: pmAdd(pm, ['tsx', '@faker-js/faker'], true) }
    case 'seed':            return { exe: 'npx', args: ['tsx', 'prisma/seed.ts'] }
    case 'dev':             return { exe: pm, args: ['run', 'dev'] }
  }
  throw new Error('UNKNOWN_COMMAND')
}

export function nextCommandLine(command: NextCommand, pm: PM, arg?: string): string {
  try { const c = nextCommand(command, pm, arg); return `${c.exe} ${c.args.join(' ')}` } catch { return '' }
}
