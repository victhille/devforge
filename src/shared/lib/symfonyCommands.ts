import type { SfCommand } from '../types'

/** Entity or controller name passed to make:* */
export const SF_NAME_RE = /^[A-Z][A-Za-z0-9]{0,62}$/

const console_ = (...args: string[]) => ({ exe: 'php', args: ['bin/console', ...args] })

/**
 * The command line behind each button of the Symfony workshop. Shared: the
 * button shows it, the main process runs it.
 */
export function sfCommand(command: SfCommand, arg = ''): { exe: string; args: string[] } {
  const named = () => { if (!SF_NAME_RE.test(arg)) throw new Error('BAD_NAME'); return arg }
  switch (command) {
    case 'database:create':      return console_('doctrine:database:create', '--if-not-exists')
    case 'database:start':       return { exe: 'docker', args: ['compose', 'up', '-d', '--wait', 'database'] }
    case 'migrations:diff':      return console_('doctrine:migrations:diff', '--no-interaction')
    case 'migrations:migrate':   return console_('doctrine:migrations:migrate', '--no-interaction', '--allow-no-migration')
    case 'migrations:prev':      return console_('doctrine:migrations:migrate', 'prev', '--no-interaction')
    case 'cache:clear':          return console_('cache:clear')
    case 'server:start':         return { exe: 'symfony', args: ['server:start', '-d', '--no-tls'] }
    case 'server:stop':          return { exe: 'symfony', args: ['server:stop'] }
    case 'install:api-platform': return { exe: 'composer', args: ['require', 'api'] }
    case 'install:serializer':   return { exe: 'composer', args: ['require', 'symfony/serializer-pack', 'symfony/validator'] }
    case 'install:fixtures':     return { exe: 'composer', args: ['require', '--dev', 'orm-fixtures', 'zenstruck/foundry'] }
    case 'install:maker':        return { exe: 'composer', args: ['require', '--dev', 'symfony/maker-bundle'] }
    case 'install:orm':          return { exe: 'composer', args: ['require', 'symfony/orm-pack'] }
    case 'composer:install':     return { exe: 'composer', args: ['install'] }
    case 'make:user':            return console_('make:user', 'User', '--is-entity', '--identity-property-name=email', '--with-password', '--no-interaction')
    case 'make:login':           return console_('make:security:form-login', '--no-interaction')
    case 'make:crud':            return console_('make:crud', named(), '--no-interaction')
    case 'make:controller':      return console_('make:controller', `${named().replace(/Controller$/, '')}Controller`, '--no-interaction')
    case 'fixtures:load':        return console_('doctrine:fixtures:load', '--no-interaction')
  }
  // From the renderer, the name is only a string
  throw new Error('UNKNOWN_COMMAND')
}

export function sfCommandLine(command: SfCommand, arg?: string): string {
  try { const c = sfCommand(command, arg); return `${c.exe} ${c.args.join(' ')}` } catch { return '' }
}
