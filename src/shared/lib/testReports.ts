import type { TestCase, TestFile, TestStatus, TestTotals } from '../types/tests'

/**
 * v3.7: each test tool's report read into one shape: files, their tests,
 * and for a failure its message, "expected" and "received", and where.
 * Pure functions: the main process runs the tool and reads the report.
 */

// eslint-disable-next-line no-control-regex
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')

/** "C:\\p\\src\\a.test.ts" → "src/a.test.ts", relative to the project */
export function relPath(path: string, root: string): string {
  const p = path.replace(/\\/g, '/')
  const r = root.replace(/\\/g, '/').replace(/\/$/, '')
  return p.toLowerCase().startsWith(`${r.toLowerCase()}/`) ? p.slice(r.length + 1) : p.replace(/^\.\//, '')
}

export function totalsOf(files: TestFile[]): TestTotals {
  const t: TestTotals = { passed: 0, failed: 0, skipped: 0 }
  for (const f of files) for (const c of f.tests) t[c.status]++
  return t
}

const firstLines = (s: string, n = 4) => s.split('\n').filter(l => l.trim()).slice(0, n).join('\n')

/**
 * "Expected" and "received" from a failure's text: Jest (Expected: / Received:),
 * Vitest and Chai (expected X to be Y), PHPUnit, pytest (assert X == Y), Rust (left / right).
 */
export function expectedActual(text: string): { expected?: string; actual?: string } {
  const t = stripAnsi(text)
  let m = t.match(/^\s*Expected[^:\n]*:\s*(.+)\n\s*Received[^:\n]*:\s*(.+)$/m)
  if (m) return { expected: m[1].trim(), actual: m[2].trim() }
  m = t.match(/expected (.+?) to (?:be|equal|deeply equal|strictly equal|have length|contain|include|match) (.+?)(?: \/\/ .*)?$/m)
  if (m) return { expected: m[2].trim(), actual: m[1].trim() }
  m = t.match(/Failed asserting that (.+?) (?:is identical to|is equal to|matches expected|is) (.+?)\.?$/m)
  if (m) return { expected: m[2].trim(), actual: m[1].trim() }
  m = t.match(/^\s*left:\s*(.+)\n\s*right:\s*(.+)$/m)
  if (m) return { expected: m[2].trim(), actual: m[1].trim() }
  m = t.match(/^(?:E\s+)?assert (.+?) == (.+)$/m)
  if (m) return { expected: m[2].trim(), actual: m[1].trim() }
  return {}
}

/** The first "file:line" of a stack that points into the project (not node_modules) */
export function locationIn(text: string, root: string, prefer?: string): { file: string; line: number } | undefined {
  const found: { file: string; line: number }[] = []
  for (const m of stripAnsi(text).matchAll(/((?:[A-Za-z]:)?[\w./\\ -]*?\.[a-z]{1,4}):(\d+)(?::\d+)?/g)) {
    const file = relPath(m[1].trim().replace(/^\(/, ''), root)
    if (/node_modules|^node:|^internal\//.test(file)) continue
    found.push({ file, line: Number(m[2]) })
  }
  return (prefer && found.find(f => f.file === prefer)) || found[0]
}

function failure(text: string, root: string, file: string): Partial<TestCase> {
  const clean = stripAnsi(text).trim()
  return { message: firstLines(clean), details: clean.slice(0, 8000), ...expectedActual(clean), location: locationIn(clean, root, file) }
}

// ─── Vitest and Jest (the same JSON) ──────────────────────────────────────────

interface JestJson {
  testResults?: {
    name: string
    message?: string
    assertionResults?: { ancestorTitles?: string[]; title: string; status: string; duration?: number | null; failureMessages?: string[]; location?: { line: number } | null }[]
  }[]
}

const jestStatus = (s: string): TestStatus => (s === 'passed' ? 'passed' : s === 'failed' ? 'failed' : 'skipped')

export function parseJestJson(json: string, root: string): TestFile[] | null {
  let r: JestJson
  try { r = JSON.parse(json) } catch { return null }
  if (!Array.isArray(r?.testResults)) return null
  return r.testResults.map(f => {
    const file = relPath(f.name, root)
    const tests: TestCase[] = (f.assertionResults ?? []).map(a => {
      const status = jestStatus(a.status)
      const base: TestCase = { name: a.title, suite: a.ancestorTitles?.length ? a.ancestorTitles.join(' › ') : undefined, status, durationMs: a.duration ?? null }
      if (status !== 'failed') return base
      const f2 = failure((a.failureMessages ?? []).join('\n'), root, file)
      return { ...base, ...f2, location: a.location ? { file, line: a.location.line } : f2.location }
    })
    // A file that could not even load: one failed "test" with its message
    if (!tests.length && f.message) tests.push({ name: '(file)', status: 'failed', durationMs: null, ...failure(f.message, root, file) })
    return { file, tests }
  })
}

// ─── Playwright ───────────────────────────────────────────────────────────────

interface PwSuite {
  title: string
  file?: string
  specs?: { title: string; file?: string; line?: number; tests?: { status?: string; results?: { status?: string; duration?: number; error?: { message?: string; stack?: string } }[] }[] }[]
  suites?: PwSuite[]
}

export function parsePlaywrightJson(json: string, root: string): TestFile[] | null {
  let r: { suites?: PwSuite[] }
  try { r = JSON.parse(json) } catch { return null }
  if (!Array.isArray(r?.suites)) return null
  const byFile = new Map<string, TestCase[]>()
  const walk = (s: PwSuite, path: string[], file: string) => {
    for (const spec of s.specs ?? []) {
      const f = spec.file ?? file
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1]
        const status: TestStatus = t.status === 'skipped' ? 'skipped' : t.status === 'expected' || t.status === 'flaky' ? 'passed' : 'failed'
        const c: TestCase = { name: spec.title, suite: path.length ? path.join(' › ') : undefined, status, durationMs: last?.duration ?? null }
        const err = last?.error
        const failed = status === 'failed' ? { ...failure(`${err?.message ?? ''}\n${err?.stack ?? ''}`, root, f), location: spec.line ? { file: f, line: spec.line } : undefined } : {}
        const list = byFile.get(f) ?? []
        list.push({ ...c, ...failed })
        byFile.set(f, list)
      }
    }
    for (const sub of s.suites ?? []) walk(sub, [...path, sub.title], sub.file ?? file)
  }
  for (const s of r.suites) walk(s, [], s.file ?? s.title)
  return [...byFile].map(([file, tests]) => ({ file: relPath(file, root), tests }))
}

// ─── JUnit XML (PHPUnit, pytest) ──────────────────────────────────────────────

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&')
const attrs = (s: string): Record<string, string> => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]))

/** A pytest class path ("tests.test_cart.TestCart") or a PHP class ("App\\Tests\\CartTest") as a file, when the report gives none */
const fileFromClass = (cls: string) => (cls.includes('\\') ? `${cls.replace(/\\/g, '/')}.php` : `${cls.split('.').filter(p => !/^[A-Z]/.test(p)).join('/')}.py`)

export function parseJunit(xml: string, root: string): TestFile[] | null {
  if (!/<testsuites?\b/.test(xml)) return null
  const byFile = new Map<string, TestCase[]>()
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const a = attrs(m[1])
    const body = m[2] ?? ''
    const file = relPath(a.file ?? fileFromClass(a.classname ?? a.class ?? 'tests'), root)
    const bad = body.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/)
    const status: TestStatus = bad ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed'
    const c: TestCase = {
      name: a.name ?? '?', suite: a.classname && a.file ? a.classname.split(/[.\\]/).pop() : undefined, status,
      durationMs: a.time ? Math.round(Number(a.time) * 1000) : null
    }
    if (bad) {
      const text = `${attrs(bad[2]).message ?? ''}\n${decode(bad[3] ?? '')}`
      Object.assign(c, failure(text, root, file))
      if (!c.location && a.line) c.location = { file, line: Number(a.line) }
    }
    const list = byFile.get(file) ?? []
    list.push(c)
    byFile.set(file, list)
  }
  return [...byFile].map(([file, tests]) => ({ file, tests }))
}

// ─── Go (go test -json) ───────────────────────────────────────────────────────

/** `module` from go.mod: "example.com/api/cart" is the folder "cart" */
export function parseGoTest(stream: string, module: string, root: string): TestFile[] | null {
  const tests = new Map<string, { pkg: string; name: string; status?: TestStatus; elapsed?: number; out: string[] }>()
  let seen = false
  const pkgFail = new Map<string, string[]>()
  for (const line of stream.split('\n')) {
    let e: { Action?: string; Package?: string; Test?: string; Elapsed?: number; Output?: string }
    try { e = JSON.parse(line) } catch { continue }
    if (!e.Package) continue
    seen = true
    if (!e.Test) {
      if (e.Action === 'output' && e.Output) pkgFail.set(e.Package, [...(pkgFail.get(e.Package) ?? []), e.Output])
      continue
    }
    // Subtests ("TestA/case") are kept as tests of their own
    const key = `${e.Package}\0${e.Test}`
    const t = tests.get(key) ?? { pkg: e.Package, name: e.Test, out: [] }
    if (e.Action === 'output' && e.Output && !/^(=== (RUN|PAUSE|CONT)|--- (PASS|FAIL|SKIP))/.test(e.Output.trim())) t.out.push(e.Output)
    if (e.Action === 'pass') t.status = 'passed'
    if (e.Action === 'fail') t.status = 'failed'
    if (e.Action === 'skip') t.status = 'skipped'
    if (e.Elapsed !== undefined) t.elapsed = e.Elapsed
    tests.set(key, t)
  }
  if (!seen) return null
  const dirOf = (pkg: string) => (pkg === module ? '' : pkg.startsWith(`${module}/`) ? pkg.slice(module.length + 1) : pkg)
  const byPkg = new Map<string, TestCase[]>()
  for (const t of tests.values()) {
    if (!t.status) continue
    const dir = dirOf(t.pkg)
    const out = t.out.join('')
    const loc = out.match(/^\s*([\w.-]+\.go):(\d+):/m)
    const c: TestCase = { name: t.name, status: t.status, durationMs: t.elapsed !== undefined ? Math.round(t.elapsed * 1000) : null }
    if (t.status === 'failed') Object.assign(c, failure(out, root, ''), loc ? { location: { file: dir ? `${dir}/${loc[1]}` : loc[1], line: Number(loc[2]) } } : {})
    byPkg.set(dir || '.', [...(byPkg.get(dir || '.') ?? []), c])
  }
  // A package that does not build: one failed entry with the compiler's words
  for (const [pkg, out] of pkgFail) {
    const text = out.join('')
    if (/^FAIL\s/m.test(text) && /\[build failed\]|cannot|undefined:|syntax error/.test(text) && !byPkg.has(dirOf(pkg) || '.')) {
      byPkg.set(dirOf(pkg) || '.', [{ name: '(build)', status: 'failed', durationMs: null, ...failure(text, root, '') }])
    }
  }
  return [...byPkg].map(([file, list]) => ({ file, tests: list }))
}

// ─── Cargo (cargo test, text) ─────────────────────────────────────────────────

export function parseCargoTest(output: string, root: string): TestFile[] | null {
  const text = stripAnsi(output)
  const files: TestFile[] = []
  let current: TestFile | null = null
  const failures = new Map<string, string>()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const run = line.match(/^\s*Running (?:unittests )?(\S+)(?: \(|$)/) ?? line.match(/^\s*Doc-tests (\S+)/)
    if (run) { current = { file: run[0].includes('Doc-tests') ? `doc-tests ${run[1]}` : relPath(run[1], root), tests: [] }; files.push(current); continue }
    const t = line.match(/^test (\S+) \.\.\. (ok|FAILED|ignored)/)
    if (t && current) { current.tests.push({ name: t[1], status: t[2] === 'ok' ? 'passed' : t[2] === 'FAILED' ? 'failed' : 'skipped', durationMs: null }); continue }
    // ---- name stdout ---- then its output, up to the next section
    const f = line.match(/^---- (\S+) stdout ----$/)
    if (f) {
      const body: string[] = []
      for (i++; i < lines.length && !/^(---- \S+ stdout ----|failures:|test result:)/.test(lines[i]); i++) body.push(lines[i])
      i--
      failures.set(f[1], body.join('\n'))
    }
  }
  if (!files.some(f => f.tests.length) && !/test result:/.test(text)) return null
  for (const f of files) {
    for (const c of f.tests) {
      const body = failures.get(c.name)
      if (c.status !== 'failed' || !body) continue
      const at = body.match(/panicked at (?:'[^']*', )?([\w./\\-]+\.rs):(\d+)/)
      Object.assign(c, failure(body, root, ''), at ? { location: { file: relPath(at[1], root), line: Number(at[2]) } } : {})
    }
  }
  return files.filter(f => f.tests.length)
}
