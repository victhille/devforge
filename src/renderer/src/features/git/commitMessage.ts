import type { GitFileChange } from '@shared/types'

export const COMMIT_TYPES = ['feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore', 'perf', 'build', 'ci'] as const
export type CommitType = typeof COMMIT_TYPES[number]

export interface CommitSuggestion {
  type: CommitType
  scope: string
  subject: string
}

const isDoc    = (p: string) => /\.(md|mdx|txt|rst)$/i.test(p) || /(^|\/)docs?\//i.test(p)
const isTest   = (p: string) => /(\.|_)(test|spec)\.[a-z]+$/i.test(p) || /(^|\/)(__tests__|tests?)\//i.test(p)
const isStyle  = (p: string) => /\.(css|scss|sass|less|styl)$/i.test(p)
const isCI     = (p: string) => /^\.github\/|^\.gitlab-ci|^\.circleci\//i.test(p)
const isBuild  = (p: string) => /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.(json|lock)|Cargo\.(toml|lock)|requirements\.txt|Dockerfile|docker-compose\.ya?ml)$/i.test(p)
const isConfig = (p: string) => /(^|\/)(\.[\w.-]+rc(\.\w+)?|\.gitignore|\.gitattributes|\.editorconfig|tsconfig[\w.-]*\.json|[\w.-]+\.config\.[cm]?[jt]s)$/i.test(p)

/** Folder names too generic to make a useful scope */
const GENERIC = new Set(['src', 'app', 'lib', 'libs', 'components', 'features', 'renderer', 'main', 'shared', 'pages', 'utils', 'services', 'packages', 'modules', 'source', 'ui', 'common', 'core', 'internal', 'pkg'])

/** File name without folders, extension or .test/.spec suffix (dotfiles kept as is) */
function baseName(p: string): string {
  const file = p.split('/').pop()!
  if (file.startsWith('.') && file.indexOf('.', 1) === -1) return file
  return file.replace(/\.[^.]+$/, '').replace(/[._](test|spec)$/i, '')
}

/** Most specific non-generic folder shared by every file. */
export function guessScope(paths: string[]): string {
  if (paths.length === 0) return ''
  const dirs = paths.map(p => p.split('/').slice(0, -1))
  const common: string[] = []
  for (let i = 0; dirs.every(d => i < d.length && d[i] === dirs[0][i]); i++) common.push(dirs[0][i])
  for (let i = common.length - 1; i >= 0; i--) {
    if (!GENERIC.has(common[i].toLowerCase()) && !common[i].startsWith('.')) return common[i].toLowerCase()
  }
  // Single file at a generic place: use its name
  return paths.length === 1 ? baseName(paths[0]).toLowerCase() : ''
}

export function guessType(changes: GitFileChange[]): CommitType {
  const paths = changes.map(c => c.path)
  const all = (fn: (p: string) => boolean) => paths.length > 0 && paths.every(fn)
  if (all(isDoc))   return 'docs'
  if (all(isTest))  return 'test'
  if (all(isCI))    return 'ci'
  if (all(isStyle)) return 'style'
  if (all(p => isBuild(p) || isConfig(p))) return paths.some(isBuild) ? 'build' : 'chore'
  const source = changes.filter(c => !isDoc(c.path) && !isTest(c.path) && !isConfig(c.path) && !isBuild(c.path))
  if (source.some(c => c.status === 'added' || c.status === 'untracked')) return 'feat'
  if (source.length > 0 && source.every(c => c.status === 'deleted' || c.status === 'renamed')) return 'refactor'
  return 'fix'
}

const VERB: Record<CommitType, string> = {
  feat: 'add', fix: 'update', refactor: 'refactor', docs: 'update', style: 'update styles of',
  test: 'add tests for', chore: 'update', perf: 'speed up', build: 'update', ci: 'update'
}

export function guessSubject(type: CommitType, changes: GitFileChange[], scope: string): string {
  if (changes.length === 0) return ''
  const allDeleted = changes.every(c => c.status === 'deleted')
  const verb = allDeleted ? 'remove' : VERB[type]
  const names = Array.from(new Set(changes.map(c => baseName(c.path))))
  if (type === 'build' && changes.every(c => isBuild(c.path))) return 'update dependencies'
  if (names.length <= 3) return `${verb} ${names.join(', ')}`
  return `${verb} ${changes.length} files${scope ? ` in ${scope}` : ''}`
}

export function suggestCommit(changes: GitFileChange[]): CommitSuggestion {
  const type = guessType(changes)
  const scope = guessScope(changes.map(c => c.path))
  return { type, scope, subject: guessSubject(type, changes, scope) }
}

export function formatCommit({ type, scope, subject }: CommitSuggestion, body = ''): string {
  const header = `${type}${scope ? `(${scope})` : ''}: ${subject.trim()}`
  return body.trim() ? `${header}\n\n${body.trim()}` : header
}
