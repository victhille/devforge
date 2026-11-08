/**
 * The project whose folder a command line points into (the deepest one wins).
 * A project at the root of a drive ("D:\\", "/") matches nothing: every process would be its own.
 */
export function projectOfCommand<P extends { path: string }>(cmd: string, projects: P[]): P | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')
  const c = cmd.toLowerCase().replace(/\\/g, '/')
  return projects
    .filter(x => { const dir = norm(x.path); return dir.replace(/^[a-z]:/, '').includes('/') && c.includes(dir + '/') })
    .sort((a, b) => b.path.length - a.path.length)[0]
}
