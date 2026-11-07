// ─── A project's tests (v3.7) ─────────────────────────────────────────────────

export type TestRunner = 'vitest' | 'jest' | 'playwright' | 'phpunit' | 'pytest' | 'go' | 'cargo'

export type TestStatus = 'passed' | 'failed' | 'skipped'

export interface TestCase {
  name: string
  /** Its describe blocks or class, "cart › total" */
  suite?: string
  status: TestStatus
  durationMs: number | null
  /** The failure's message (first lines) and its full text */
  message?: string
  details?: string
  /** When the tool says them: "Expected" and "Received" (left / right in Rust) */
  expected?: string
  actual?: string
  /** Where it failed, relative to the project */
  location?: { file: string; line: number }
}

export interface TestFile { file: string; tests: TestCase[] }

export interface TestTotals { passed: number; failed: number; skipped: number }

export interface TestRun {
  runner: TestRunner
  startedAt: string
  durationMs: number
  totals: TestTotals
  files: TestFile[]
  /** The command's output, its last part */
  output: string
  command: string
  exitCode: number | null
  cancelled?: boolean
  /** No report could be read (the tool crashed, a syntax error…): the output says why */
  error?: string
}

export interface TestRunnerInfo {
  runner: TestRunner
  /** What it needs and this PC lacks (the virtual environment, go, cargo…) */
  missing?: { name: string; install: string }
}

export interface TestsAPI {
  /** The test tools of a saved project's folder */
  detect: (path: string) => Promise<TestRunnerInfo[]>
  /** Runs them (only these files when given, relative paths); the output comes through onOutput */
  run: (path: string, runner: TestRunner, files?: string[]) => Promise<TestRun>
  stop: () => Promise<void>
  /** The last run kept for this folder and tool */
  last: (path: string, runner: TestRunner) => Promise<TestRun | null>
  onOutput: (cb: (line: string) => void) => () => void
}
