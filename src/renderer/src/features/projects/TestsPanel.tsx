import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, Circle, FlaskConical, Play, RotateCw, Square, X } from 'lucide-react'
import type { TestCase, TestFile, TestRun, TestRunner, TestRunnerInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatRelative } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import { errorText } from '@renderer/lib/errors'

const LABEL: Record<TestRunner, string> = { vitest: 'Vitest', jest: 'Jest', playwright: 'Playwright', phpunit: 'PHPUnit', pytest: 'pytest', go: 'Go', cargo: 'Cargo' }

const ms = (n: number | null | undefined, lang: string) =>
  n === null || n === undefined ? '' : n >= 1000 ? `${(n / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })} s` : `${Math.round(n)} ms`

export function StatusIcon({ status, size = 13 }: { status: TestCase['status']; size?: number }) {
  return status === 'passed' ? <Check size={size} className="shrink-0 text-success" aria-hidden />
    : status === 'failed' ? <X size={size} className="shrink-0 text-danger" aria-hidden />
    : <Circle size={size - 3} className="shrink-0 text-fg-muted" aria-hidden />
}

/** v3.7 lot 2: a failed test, unfolded: its message, expected and received, where; rerun, Forgy */
function Failure({ test, onOpen, onRerun, onExplain, running }: {
  test: TestCase; onOpen?: (file: string, line: number) => void; onRerun: () => void; onExplain: () => void; running: boolean
}) {
  const { t } = useI18n()
  const k = t.tests
  return (
    <div className="flex flex-col gap-2.5 border-t border-line-subtle bg-danger-soft/25 py-3 pr-4 pl-10" data-testid="test-failure">
      {test.message && <pre className="font-mono text-[12.5px] font-medium whitespace-pre-wrap text-danger">{test.message}</pre>}
      {(test.expected !== undefined || test.actual !== undefined) && (
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 font-mono text-[12.5px]">
          <dt className="text-fg-muted">{k.expected}</dt><dd className="break-all text-success">{test.expected ?? '—'}</dd>
          <dt className="text-fg-muted">{k.received}</dt><dd className="break-all text-danger">{test.actual ?? '—'}</dd>
        </dl>
      )}
      {test.location && (
        <div className="text-xs text-fg-secondary">
          {k.at}{' '}
          {onOpen
            ? <button onClick={() => onOpen(test.location!.file, test.location!.line)} className="font-mono text-accent underline hover:text-accent-hover">{test.location.file}:{test.location.line}</button>
            : <span className="font-mono">{test.location.file}:{test.location.line}</span>}
        </div>
      )}
      {test.details && test.details !== test.message && (
        <details className="text-xs"><summary className="cursor-pointer text-fg-secondary">{k.details}</summary>
          <pre className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-console p-3 font-mono text-[11.5px] whitespace-pre-wrap text-fg-secondary" tabIndex={0}>{test.details}</pre>
        </details>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={running} onClick={onRerun}><RotateCw size={12} /> {k.rerunFile}</Button>
        <Button size="sm" variant="secondary" onClick={onExplain} className="text-forgy"><Bot size={13} /> {k.explain}</Button>
      </div>
    </div>
  )
}

/** One of the four figures above the list */
function Figure({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className={cn('min-w-[140px] flex-1 rounded-xl border bg-surface px-4 py-3', tone === 'danger' ? 'border-danger/40' : 'border-line-subtle')}>
      <div className="font-mono text-[11px] text-fg-muted uppercase">{label}</div>
      <div className={cn('text-[22px] font-semibold', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>{value}</div>
    </div>
  )
}

export interface FileRowProps {
  file: TestFile
  open: boolean
  onToggle: () => void
  lang: string
  /** v3.7 lot 2: what a test shows under it, and the file's own actions */
  renderTest?: (test: TestCase) => React.ReactNode
  actions?: React.ReactNode
}

/** A file and its tests (folded unless one failed) */
function FileRow({ file, open, onToggle, lang, renderTest, actions }: FileRowProps) {
  const { t } = useI18n()
  const k = t.tests
  const failed = file.tests.filter(x => x.status === 'failed').length
  const skipped = file.tests.filter(x => x.status === 'skipped').length
  const time = file.tests.reduce((n, x) => n + (x.durationMs ?? 0), 0)
  const summary = [failed ? k.fileFailed.replace('{n}', String(failed)) : '', skipped ? k.fileSkipped.replace('{n}', String(skipped)) : '',
    k.fileTests.replace('{n}', String(file.tests.length)), time ? ms(time, lang) : ''].filter(Boolean).join(' · ')
  return (
    <div className="border-t border-line-subtle first:border-t-0" data-testid="test-file">
      <div className="flex items-center gap-2.5 bg-elevated px-4 py-2">
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          {open ? <ChevronDown size={13} className="shrink-0 text-fg-muted" /> : <ChevronRight size={13} className="shrink-0 text-fg-muted" />}
          <StatusIcon status={failed ? 'failed' : file.tests.every(x => x.status === 'skipped') ? 'skipped' : 'passed'} />
          <span className="truncate font-mono text-[12.5px] font-semibold text-fg">{file.file}</span>
          <span className="ml-auto shrink-0 text-[11.5px] text-fg-muted">{summary}</span>
        </button>
        {actions}
      </div>
      {open && file.tests.map((test, i) => (
        <div key={i}>
          <div className={cn('flex items-center gap-2.5 border-t border-line-subtle py-1.5 pr-4 pl-10 font-mono text-[12.5px]', test.status === 'failed' && 'bg-danger-soft/40')}>
            <StatusIcon status={test.status} />
            <span className={cn('min-w-0 truncate', test.status === 'skipped' ? 'text-fg-muted' : 'text-fg')}>
              {test.suite && <span className="text-fg-muted">{test.suite} › </span>}{test.name}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-fg-muted">{test.status === 'skipped' ? k.skipped : ms(test.durationMs, lang)}</span>
          </div>
          {renderTest?.(test)}
        </div>
      ))}
    </div>
  )
}

/**
 * v3.7: a project's tests (piste A of the mock-up): the tool, Run, four
 * figures, the tests by file, the command's output below.
 */
export default function TestsPanel({ path, runners, projectName, onOpen }: {
  path: string
  runners: TestRunnerInfo[]
  projectName?: string
  /** v3.7 lot 2: a failure's place, opened in the Files tab */
  onOpen?: (file: string, line: number) => void
}) {
  const { t, lang } = useI18n()
  const k = t.tests
  const { ask } = useAssistant()
  const [onlyFailed, setOnlyFailed] = useState(false)
  const usable = runners.filter(r => !r.missing)
  const [runner, setRunner] = useState<TestRunner | null>(usable[0]?.runner ?? runners[0]?.runner ?? null)
  const [run, setRun] = useState<TestRun | null>(null)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const outRef = useRef<HTMLPreElement>(null)

  const info = runners.find(r => r.runner === runner)
  // The tools may arrive after the first render (the page opened on this tab)
  const fallback = usable[0]?.runner ?? runners[0]?.runner ?? null
  useEffect(() => { if (!runner || !runners.some(r => r.runner === runner)) setRunner(fallback) }, [runners, runner, fallback])

  // The last run of this tool, kept from before
  useEffect(() => {
    if (!runner) return
    let alive = true
    setRun(null)
    window.devforge.tests.last(path, runner).then(r => { if (alive && r) { setRun(r); setOutput(r.output.split('\n')) } }).catch(() => {})
    return () => { alive = false }
  }, [path, runner])

  useEffect(() => window.devforge.tests.onOutput(line => setOutput(o => [...o.slice(-3000), line])), [])
  useEffect(() => { const el = outRef.current; if (el && running) el.scrollTop = el.scrollHeight }, [output, running])

  // Failed files open, the others folded
  useEffect(() => { if (run) setOpen(new Set(run.files.filter(f => f.tests.some(x => x.status === 'failed')).map(f => f.file))) }, [run])

  const start = useCallback(async (files?: string[]) => {
    if (!runner) return
    setRunning(true)
    setError('')
    setOutput([])
    try {
      const r = await window.devforge.tests.run(path, runner, files)
      // A partial run (some files) updates those files only
      setRun(prev => (files?.length && prev && !r.error && !r.cancelled
        ? { ...r, files: prev.files.map(f => r.files.find(x => x.file === f.file) ?? f), totals: prev.totals }
        : r))
    } catch (err) {
      setError(errorText(err))
    } finally { setRunning(false) }
  }, [path, runner])

  if (!runners.length || !runner) return <EmptyState icon={<FlaskConical size={28} />} title={k.none} />

  // Recomputed for a partial run
  const totals = run ? run.files.reduce((t2, f) => { for (const x of f.tests) t2[x.status]++; return t2 }, { passed: 0, failed: 0, skipped: 0 }) : null
  const failedFiles = run ? run.files.filter(f => f.tests.some(x => x.status === 'failed')).map(f => f.file) : []
  const shown = run ? run.files.flatMap(f => {
    if (!onlyFailed) return [f]
    const tests = f.tests.filter(x => x.status === 'failed')
    return tests.length ? [{ ...f, tests }] : []
  }) : []
  // Whole-project reruns name real files; "(file)" or doc tests do not
  const rerunnable = (file: string) => !file.startsWith('doc-tests ') && file !== '.'

  function explain(file: TestFile, test: TestCase) {
    ask(k.explainPrompt
      .replace('{project}', projectName ?? path).replace('{tool}', LABEL[runner!])
      .replace('{test}', [test.suite, test.name].filter(Boolean).join(' › ')).replace('{file}', test.location ? `${test.location.file}:${test.location.line}` : file.file)
      + `\n\n\`\`\`\n${(test.details ?? test.message ?? '').slice(0, 3500)}\n\`\`\``)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {runners.length > 1 && (
          <Select aria-label={k.runner} value={runner} onChange={e => setRunner(e.target.value as TestRunner)} disabled={running} className="h-8 w-auto py-0 text-sm">
            {runners.map(r => <option key={r.runner} value={r.runner}>{LABEL[r.runner]}</option>)}
          </Select>
        )}
        {running
          ? <Button size="sm" variant="secondary" onClick={() => window.devforge.tests.stop()}><Square size={12} /> {k.stop}</Button>
          : <Button size="sm" disabled={!!info?.missing} onClick={() => start()}><Play size={13} /> {k.run.replace('{tool}', LABEL[runner])}</Button>}
        {failedFiles.length > 0 && !running && (
          <Button size="sm" variant="secondary" onClick={() => start(failedFiles.filter(rerunnable))}><RotateCw size={12} /> {k.rerunFailed.replace('{n}', String(totals?.failed ?? 0))}</Button>
        )}
        {run && (
          <span role="group" aria-label={k.filter} className="flex rounded-full border border-line p-0.5 text-xs">
            {[false, true].map(v => (
              <button key={String(v)} aria-pressed={onlyFailed === v} onClick={() => setOnlyFailed(v)}
                className={cn('rounded-full px-3 py-1', onlyFailed === v ? 'bg-active text-fg' : 'text-fg-secondary hover:text-fg')}>{v ? k.onlyFailed : k.all}</button>
            ))}
          </span>
        )}
        {running && <span className="flex items-center gap-2 text-sm text-fg-secondary"><Spinner /> {k.running}</span>}
        {run && !running && <span className="ml-auto text-xs text-fg-muted">{k.lastRun.replace('{when}', formatRelative(run.startedAt, lang))}</span>}
      </div>

      {info?.missing && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
          {k.missing.replace('{tool}', info.missing.name)}
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg">{info.missing.install}</code>
          <CopyButton text={info.missing.install} title={t.packages.copyCommand} />
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      {run && totals && (
        <>
          <div className="flex flex-wrap gap-3">
            <Figure label={k.passed} value={String(totals.passed)} tone={totals.passed ? 'success' : undefined} />
            <Figure label={k.failed} value={String(totals.failed)} tone={totals.failed ? 'danger' : undefined} />
            <Figure label={k.skippedTitle} value={String(totals.skipped)} />
            <Figure label={k.duration} value={ms(run.durationMs, lang)} />
          </div>
          {run.cancelled && <p role="status" className="text-sm text-warning">{k.cancelled}</p>}
          {run.error === 'NO_REPORT' && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{k.noReport}</p>}
          {shown.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-surface" data-testid="test-files">
              {shown.map(f => (
                <FileRow key={f.file} file={f} lang={lang} open={open.has(f.file)}
                  onToggle={() => setOpen(prev => { const n = new Set(prev); if (n.has(f.file)) n.delete(f.file); else n.add(f.file); return n })}
                  renderTest={test => test.status === 'failed'
                    ? <Failure test={test} onOpen={onOpen} running={running} onRerun={() => start([f.file])} onExplain={() => explain(f, test)} />
                    : null}
                  actions={rerunnable(f.file) && !running
                    ? <button onClick={() => start([f.file])} title={k.rerunFile} aria-label={`${k.rerunFile} ${f.file}`} className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"><RotateCw size={12} /></button>
                    : null} />
              ))}
            </div>
          )}
          {!run.files.length && !run.error && !run.cancelled && <p className="text-sm text-fg-muted">{k.noTests}</p>}
        </>
      )}

      {(running || output.length > 0) && (
        <details open={running || run?.error === 'NO_REPORT'} className="rounded-xl border border-line bg-console">
          <summary className="cursor-pointer px-4 py-2 text-xs text-fg-secondary">{k.output.replace('{cmd}', run?.command ?? output[0]?.replace(/^> /, '') ?? '')}</summary>
          <pre ref={outRef} tabIndex={0} aria-label={k.outputLabel} className="max-h-80 overflow-auto border-t border-line-subtle px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg-secondary">{output.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
