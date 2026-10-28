/**
 * v3.5.3: the highlight.js grammar for a file, from its name. null: plain
 * text (no colours). Vue and Svelte files read as HTML, whose <script> and
 * <style> blocks get their own colours.
 */

export type CodeLanguage =
  | 'typescript' | 'javascript' | 'xml' | 'css' | 'scss' | 'json' | 'php' | 'twig' | 'python' | 'yaml'
  | 'dockerfile' | 'ini' | 'bash' | 'powershell' | 'sql' | 'go' | 'rust' | 'ruby' | 'java' | 'kotlin'
  | 'csharp' | 'dart' | 'c' | 'cpp' | 'swift' | 'nginx' | 'makefile' | 'properties' | 'graphql' | 'markdown'

const BY_EXT: Record<string, CodeLanguage> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml', svelte: 'xml', csproj: 'xml', xaml: 'xml', plist: 'xml',
  css: 'css', scss: 'scss', sass: 'scss', less: 'scss',
  json: 'json', jsonc: 'json', json5: 'json', webmanifest: 'json', lock: 'json',
  php: 'php', twig: 'twig', py: 'python', pyi: 'python', yml: 'yaml', yaml: 'yaml',
  toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'properties', properties: 'properties',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', psm1: 'powershell', sql: 'sql',
  go: 'go', rs: 'rust', rb: 'ruby', java: 'java', kt: 'kotlin', kts: 'kotlin', gradle: 'kotlin',
  cs: 'csharp', dart: 'dart', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', swift: 'swift',
  graphql: 'graphql', gql: 'graphql', md: 'markdown', mdx: 'markdown'
}

const BY_NAME: Record<string, CodeLanguage> = {
  dockerfile: 'dockerfile', containerfile: 'dockerfile', makefile: 'makefile', gnumakefile: 'makefile',
  gemfile: 'ruby', rakefile: 'ruby', pipfile: 'ini', 'nginx.conf': 'nginx', '.gitignore': 'bash', '.dockerignore': 'bash'
}

export function codeLanguage(name: string): CodeLanguage | null {
  const lower = name.toLowerCase()
  if (BY_NAME[lower]) return BY_NAME[lower]
  // Dockerfile.dev, .env.local, .env.example
  if (lower.startsWith('dockerfile')) return 'dockerfile'
  if (lower === '.env' || lower.startsWith('.env.')) return 'properties'
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return null
  // package-lock.json yes, yarn.lock / Cargo.lock not JSON
  if (lower.endsWith('.lock') && lower !== 'composer.lock') return null
  return BY_EXT[lower.slice(dot + 1)] ?? null
}
