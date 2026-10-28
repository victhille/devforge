/**
 * v3.5 lot 5: completion while typing a command: the PATH's programs for the
 * first word, then the known sub-commands of the usual tools, and the
 * commands already in the Docs page. Pure: the lists come from the caller.
 */

/** Sub-commands, by the command that takes them (longest prefix wins) */
export const SUBCOMMANDS: Record<string, string[]> = {
  git: ['add', 'branch', 'checkout', 'cherry-pick', 'clone', 'commit', 'diff', 'fetch', 'init', 'log', 'merge', 'pull', 'push', 'rebase', 'remote', 'reset', 'restore', 'stash', 'status', 'switch', 'tag'],
  npm: ['audit', 'ci', 'init', 'install', 'ls', 'outdated', 'publish', 'run', 'start', 'test', 'uninstall', 'update'],
  pnpm: ['add', 'dlx', 'install', 'remove', 'run', 'test', 'update'],
  yarn: ['add', 'dlx', 'install', 'remove', 'run', 'test', 'upgrade'],
  npx: ['prisma', 'vite', 'tsc', 'eslint', 'create-next-app', 'shadcn'],
  composer: ['create-project', 'dump-autoload', 'install', 'outdated', 'remove', 'require', 'show', 'update', 'validate'],
  'php artisan': ['cache:clear', 'config:clear', 'db:seed', 'make:controller', 'make:migration', 'make:model', 'migrate', 'migrate:fresh', 'queue:work', 'route:list', 'serve', 'test', 'tinker'],
  'php bin/console': ['cache:clear', 'debug:router', 'doctrine:migrations:migrate', 'make:controller', 'make:entity', 'make:migration', 'make:user', 'messenger:consume'],
  'symfony console': ['cache:clear', 'debug:router', 'doctrine:migrations:migrate', 'make:controller', 'make:entity', 'make:migration'],
  symfony: ['console', 'new', 'serve', 'server:stop', 'check:requirements'],
  docker: ['build', 'compose', 'exec', 'images', 'logs', 'ps', 'pull', 'rm', 'run', 'stop'],
  'docker compose': ['build', 'down', 'exec', 'logs', 'ps', 'pull', 'restart', 'up'],
  gh: ['auth', 'issue', 'pr', 'release', 'repo', 'run', 'workflow']
}

/** Up to `max` completions of `input`, each a whole command line */
export function completeCommand(input: string, sources: { programs: string[]; commands: string[] }, max = 8): string[] {
  const text = input.replace(/^\s+/, '')
  if (!text) return []
  const lower = text.toLowerCase()
  const out: string[] = []
  const add = (s: string) => { if (s.toLowerCase() !== lower && !out.includes(s)) out.push(s) }

  // Commands already in the Docs page that start with it
  for (const c of sources.commands) if (c.toLowerCase().startsWith(lower)) add(c)

  if (!/\s/.test(text)) {
    // The first word: a known tool, then the PATH's programs
    for (const p of [...Object.keys(SUBCOMMANDS).filter(k => !k.includes(' ')), ...sources.programs]) if (p.startsWith(lower)) add(p)
  } else {
    // A sub-command of the longest known prefix (php bin/console before php)
    const base = Object.keys(SUBCOMMANDS).filter(k => lower.startsWith(`${k} `)).sort((a, b) => b.length - a.length)[0]
    if (base) {
      const rest = text.slice(base.length + 1)
      if (!/\s/.test(rest)) for (const sub of SUBCOMMANDS[base]) if (sub.startsWith(rest.toLowerCase())) add(`${text.slice(0, base.length)} ${sub}`)
    }
  }
  return out.slice(0, max)
}
