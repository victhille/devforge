/**
 * v3.8 lot 5: a project saved as a template. What is left out (secrets
 * always), and the project's name replaced in the copy.
 */

/** Proposed when saving: dependencies, builds, Git, virtual environments */
export const DEFAULT_EXCLUDE = [
  'node_modules', 'vendor', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', 'out', 'coverage',
  'target', '__pycache__', '.venv', 'venv', '.pytest_cache', 'var/cache', 'var/log', '.DS_Store', 'Thumbs.db'
]

/** Kept: env files meant to be committed */
const ENV_KEPT = ['.env.example', '.env.sample', '.env.template', '.env.dist']

/** `.env` and `.env.*` (but the examples): never in a template, whatever the list says */
export const isSecretFile = (name: string) => (name === '.env' || name.startsWith('.env.')) && !ENV_KEPT.includes(name)

const globRe = (pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`, 'i')

/** A list typed by the user: one pattern per line or comma, cleaned */
export const parseExclude = (text: string) => [...new Set(text.split(/[\n,]/).map(s => s.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')).filter(Boolean))]

/**
 * Left out: a secret file, or a path one of whose names matches a pattern
 * (`node_modules`, `*.log`), or that starts with a pattern holding a slash
 * (`var/cache`). Paths use `/`.
 */
export function isExcluded(relPath: string, patterns: string[]): boolean {
  const parts = relPath.split('/')
  if (isSecretFile(parts[parts.length - 1])) return true
  return patterns.some(p => {
    if (p.includes('/')) return relPath === p || relPath.startsWith(`${p}/`) || globRe(p).test(relPath)
    const re = globRe(p)
    return parts.some(part => re.test(part))
  })
}

/** A name npm accepts: lower case, no spaces */
const npmName = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')

/**
 * The file with the project's name replaced where it names the project:
 * package.json (and its lock), composer.json, pyproject.toml, Cargo.toml, the
 * README's title. null when the file does not change.
 */
export function renameIn(relPath: string, content: string, from: string, to: string): string | null {
  const base = relPath.toLowerCase()
  const same = (v: unknown) => typeof v === 'string' && v.toLowerCase() === from.toLowerCase()
  if (base === 'package.json' || base === 'package-lock.json') {
    try {
      const json = JSON.parse(content) as { name?: string; packages?: Record<string, { name?: string }> }
      let changed = false
      if (same(json.name) || base === 'package.json') { if (json.name !== undefined) { json.name = npmName(to); changed = true } }
      if (json.packages?.['']?.name !== undefined) { json.packages[''].name = npmName(to); changed = true }
      if (!changed) return null
      const indent = /^\{\r?\n(\s+)/.exec(content)?.[1] ?? '  '
      return JSON.stringify(json, null, indent) + (content.endsWith('\n') ? '\n' : '')
    } catch { return null }
  }
  if (base === 'composer.json') {
    try {
      const json = JSON.parse(content) as { name?: string }
      if (typeof json.name !== 'string') return null
      const [vendor, pkg] = json.name.includes('/') ? json.name.split('/') : ['', json.name]
      if (!same(pkg)) return null
      json.name = `${vendor ? `${vendor}/` : ''}${npmName(to)}`
      const indent = /^\{\r?\n(\s+)/.exec(content)?.[1] ?? '    '
      return JSON.stringify(json, null, indent) + (content.endsWith('\n') ? '\n' : '')
    } catch { return null }
  }
  if (base === 'pyproject.toml' || base === 'cargo.toml') {
    const re = /^(name\s*=\s*["'])([^"']+)(["'])/m
    const m = re.exec(content)
    if (!m || !same(m[2])) return null
    return content.replace(re, `$1${base === 'cargo.toml' ? to.toLowerCase().replace(/-/g, '_') : to}$3`)
  }
  if (/^readme(\.md)?$/i.test(relPath)) {
    const re = /^#\s+(.+)$/m
    const m = re.exec(content)
    if (!m || !m[1].toLowerCase().includes(from.toLowerCase())) return null
    return content.replace(re, `# ${m[1].replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), to)}`)
  }
  return null
}

// ─── Archive: one file per template ──────────────────────────────────────────

const MAGIC = 'DFTPL1'

/** The files in one buffer: a header (paths and sizes), then their bytes (gzipped by the caller) */
export function packFiles(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify({ magic: MAGIC, files: files.map(f => ({ path: f.path, size: f.data.length })) }))
  const out = new Uint8Array(4 + header.length + files.reduce((n, f) => n + f.data.length, 0))
  new DataView(out.buffer).setUint32(0, header.length)
  out.set(header, 4)
  let at = 4 + header.length
  for (const f of files) { out.set(f.data, at); at += f.data.length }
  return out
}

/** The files back; paths that would leave the folder are refused */
export function unpackFiles(buf: Uint8Array): { path: string; data: Uint8Array }[] {
  const len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0)
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len))) as { magic?: string; files?: { path: string; size: number }[] }
  if (header.magic !== MAGIC || !Array.isArray(header.files)) throw new Error('Not a DevForge template')
  let at = 4 + len
  return header.files.map(f => {
    if (typeof f.path !== 'string' || !f.path || f.path.startsWith('/') || /(^|\/)\.\.(\/|$)/.test(f.path) || /^[a-z]:/i.test(f.path) || f.path.includes('\\')) throw new Error(`Unsafe path: ${f.path}`)
    const data = buf.subarray(at, at + f.size)
    at += f.size
    return { path: f.path, data }
  })
}
