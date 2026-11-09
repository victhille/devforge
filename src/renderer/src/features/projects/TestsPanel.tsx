import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Check, Circle, FlaskConical, Play, RotateCw, Square, X } from 'lucide-react'
import type { TestCase, TestFile, TestRun, TestRunner, TestRunnerInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatRelative } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Badge from '@renderer/components/ui/Badge'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import { errorText } from '@renderer/lib/errors'
import Notice from '@renderer/components/ui/Notice'
import { TEST_TOOL } from './testTools'

const LABEL = TEST_TOOL

const ms = (n: number | null | undefined, lang: string) =>
  n === null || n === undefined ? '' : n >= 1000 ? `${(n / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })} s` : `${Math.round(n)} ms`

export function StatusIcon({ status, size = 13 }: { status: TestCase['status']; size?: number }) {
  return status === 'passed' ? <Check size={size} className="shrink-0 text-success" aria-hidden />
    : status === 'failed' ? <X size={size} className="shrink-0 text-danger" aria-hidden />
    : <Circle size={size - 3} className="shrink-0 text-fg-muted" aria-hidden />
}

/** v3.7 lot 2: a failed test in the detail, as in the mock-up: its message, expected and received, where; Forgy, rerun it, open its file */
function Failure({ file, test, onOpen, onRerunTest, onExplain, running }: {
  file: string; test: TestCase; onOpen?: (file: string, line: number) => void; onRerunTest: () => void; onExplain: () => void; running: boolean
}) {
  const { t } = useI18n()
  const k = t.tests
  return (
    <div className="flex flex-col gap-3" data-testid="test-failure">
      <div className="flex flex-wrap items-start gap-3">
        <h3 className="min-w-0 flex-1 font-mono text-md font-semibold break-words text-fg">
          {file.split('/').pop()} › {[test.suite, test.name].filter(Boolean).join(' › ')}
        </h3>
        <button type="button" onClick={onExplain}
          className="inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-md bg-accent-soft px-3 text-sm font-semibold text-accent hover:bg-accent/20">
          <Bot size={13} aria-hidden /> {k.explain}
        </button>
      </div>
      {/* Wrapped anywhere (a long path too): a box that scrolled sideways would need the keyboard's focus */}
      {test.message && <pre className="rounded-control bg-term px-3.5 py-3 font-mono text-sm leading-[1.65] whitespace-pre-wrap wrap-anywhere text-danger">{test.message}</pre>}
      {(test.expected !== undefined || test.actual !== undefined) && (
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 font-mono text-sm">
          <dt className="text-fg-muted">{k.expected}</dt><dd className="break-all text-success">{test.expected ?? '—'}</dd>
          <dt className="text-fg-muted">{k.received}</dt><dd className="break-all text-danger">{test.actual ?? '—'}</dd>
        </dl>
      )}
      {test.location && (
        <p className="text-sm text-fg-secondary">
          {k.at}{' '}
          {onOpen
            ? <button onClick={() => onOpen(test.location!.file, test.location!.line)} className="font-mono text-accent underline hover:text-accent-hover">{test.location.file}:{test.location.line}</button>
            : <span className="font-mono">{test.location.file}:{test.location.line}</span>}
        </p>
      )}
      {test.details && test.details !== test.message && (
        <details className="text-sm"><summary className="cursor-pointer text-fg-secondary">{k.details}</summary>
          <pre className="mt-1.5 max-h-60 overflow-auto rounded-control bg-term p-3 font-mono text-xs whitespace-pre-wrap text-term-fg" tabIndex={0}>{test.details}</pre>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={running} onClick={onRerunTest}><RotateCw size={12} /> {k.rerunTest}</Button>
        {test.location && onOpen && <Button size="sm" variant="ghost" onClick={() => onOpen(test.location!.file, test.location!.line)}>{k.openFile}</Button>}
      </div>
    </div>
  )
}

/** A file of the list: its state, its name, how many tests and how long; a failed one on red */
function FileItem({ file, selected, onSelect, lang }: { file: TestFile; selected: boolean; onSelect: () => void; lang: string }) {
  const { t } = useI18n()
  const k = t.tests
  const failed = file.tests.filter(x => x.status === 'failed').length
  const skipped = file.tests.filter(x => x.status === 'skipped').length
  const time = file.tests.reduce((n, x) => n + (x.durationMs ?? 0), 0)
  const summary = [failed ? k.fileFailed.replace('{n}', String(failed)) : '', skipped ? k.fileSkipped.replace('{n}', String(skipped)) : '',
    k.fileTests.replace('{n}', String(file.tests.length)), time ? ms(time, lang) : ''].filter(Boolean).join(' · ')
  return (
    <li data-testid="test-file" className={cn('border-b border-line-subtle last:border-b-0', failed > 0 && 'bg-danger-soft')}>
      <button type="button" onClick={onSelect} aria-pressed={selected}
        className={cn('flex min-h-9.5 w-full min-w-0 items-center gap-2.5 px-3.5 text-left transition-colors', selected ? 'bg-elevated' : 'hover:bg-hover')}>
        <StatusIcon status={failed ? 'failed' : file.tests.every(x => x.status === 'skipped') ? 'skipped' : 'passed'} size={14} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{file.file}</span>
        <span className={cn('shrink-0 text-xs', failed ? 'text-danger' : 'text-fg-muted')}>{summary}</span>
      </button>
    </li>
  )
}

/**
 * v3.7: a project's tests, as in the mock-up: the tool and Run, the totals as
 * badges, the files on the left, the chosen file on the right (its first failure
 * in detail, then its tests); the command's output below.
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
  /** The file shown on the right, and its failure in detail */
  const [picked, setPicked] = useState<string | null>(null)
  const [pickedTest, setPickedTest] = useState<number>(0)
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

  // A new run shows its first failed file (else its first file), and that file's first failure
  useEffect(() => {
    if (!run) return
    setPicked(prev => (prev && run.files.some(f => f.file === prev) ? prev : run.files.find(f => f.tests.some(x => x.status === 'failed'))?.file ?? run.files[0]?.file ?? null))
    setPickedTest(0)
  }, [run])

  const start = useCallback(async (files?: string[], testName?: string) => {
    if (!runner) return
    setRunning(true)
    setError('')
    setOutput([])
    try {
      const r = await window.devforge.tests.run(path, runner, files, testName)
      // A partial run (some files, a test) updates what it ran only
      setRun(prev => (files?.length && prev && !r.error && !r.cancelled
        ? { ...r, files: prev.files.map(f => {
          const fresh = r.files.find(x => x.file === f.file)
          if (!fresh) return f
          // One test run again: the file's other tests keep their result
          return testName ? { ...f, tests: f.tests.map(x => fresh.tests.find(y => y.name === x.name && y.suite === x.suite) ?? x) } : fresh
        }), totals: prev.totals }
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
  const file = run?.files.find(f => f.file === picked) ?? null
  const failures = file ? file.tests.filter(x => x.status === 'failed') : []
  const failure = failures[Math.min(pickedTest, failures.length - 1)] ?? null

  function explain(f: TestFile, test: TestCase) {
    ask(k.explainPrompt
      .replace('{project}', projectName ?? path).replace('{tool}', LABEL[runner!])
      .replace('{test}', [test.suite, test.name].filter(Boolean).join(' › ')).replace('{file}', test.location ? `${test.location.file}:${test.location.line}` : f.file)
      + `\n\n\`\`\`\n${(test.details ?? test.message ?? '').slice(0, 3500)}\n\`\`\``)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {runners.length > 1 && (
          <Select aria-label={k.runner} value={runner} onChange={e => setRunner(e.target.value as TestRunner)} disabled={running} className="h-7.5 w-auto py-0 text-sm">
            {runners.map(r => <option key={r.runner} value={r.runner}>{LABEL[r.runner]}</option>)}
          </Select>
        )}
        {running
          ? <Button size="sm" variant="secondary" onClick={() => window.devforge.tests.stop()}><Square size={12} /> {k.stop}</Button>
          : <Button size="sm" disabled={!!info?.missing} onClick={() => start()}><Play size={13} /> {k.run.replace('{tool}', LABEL[runner])}</Button>}
        {failedFiles.length > 0 && !running && (
          <Button size="sm" variant="secondary" onClick={() => start(failedFiles.filter(rerunnable))}><RotateCw size={12} /> {k.rerunFailed.replace('{n}', String(totals?.failed ?? 0))}</Button>
        )}
        {totals && (
          <span data-testid="test-totals" className="flex flex-wrap items-center gap-1.5">
            <Badge color="success">{k.totalPassed.replace('{n}', String(totals.passed))}</Badge>
            {totals.failed > 0 && <Badge color="danger">{k.totalFailed.replace('{n}', String(totals.failed))}</Badge>}
            {totals.skipped > 0 && <Badge>{k.totalSkipped.replace('{n}', String(totals.skipped))}</Badge>}
          </span>
        )}
        {run && <span className="text-sm text-fg-muted">{LABEL[run.runner]} · {ms(run.durationMs, lang)}</span>}
        {running && <span className="flex items-center gap-2 text-sm text-fg-secondary"><Spinner /> {k.running}</span>}
        <span className="flex-1" />
        {run && (
          <span role="group" aria-label={k.filter} className="flex rounded-control border border-line p-0.5 text-sm">
            {[false, true].map(v => (
              <button key={String(v)} aria-pressed={onlyFailed === v} onClick={() => setOnlyFailed(v)}
                className={cn('h-7 rounded-md px-3', onlyFailed === v ? 'bg-active font-semibold text-fg' : 'text-fg-secondary hover:text-fg')}>{v ? k.onlyFailed : k.all}</button>
            ))}
          </span>
        )}
        {run && !running && <span className="text-xs text-fg-muted">{k.lastRun.replace('{when}', formatRelative(run.startedAt, lang))}</span>}
      </div>

      {info?.missing && (
        <Notice tone="warning" role="status" className="text-sm" action={<CopyButton text={info.missing.install} title={t.packages.copyCommand} />}>
          {k.missing.replace('{tool}', info.missing.name)} <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg">{info.missing.install}</code>
        </Notice>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      {run && totals && (
        <>
          {run.cancelled && <p role="status" className="text-sm text-warning">{k.cancelled}</p>}
          {run.error === 'NO_REPORT' && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{k.noReport}</p>}
          {shown.length > 0 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* The files */}
              <ul aria-label={k.filesLabel} className="self-start overflow-hidden rounded-card border border-line-subtle bg-surface py-1.5 lg:col-span-5" data-testid="test-files">
                {shown.map(f => (
                  <FileItem key={f.file} file={f} lang={lang} selected={picked === f.file} onSelect={() => { setPicked(f.file); setPickedTest(0) }} />
                ))}
              </ul>
              {/* The chosen file: its failure in detail, then its tests */}
              <section aria-label={file ? file.file : k.pickFile} data-testid="test-detail"
                className="flex min-w-0 flex-col gap-4 self-start rounded-card border border-line-subtle bg-surface p-4.5 lg:col-span-7">
                {!file ? <p className="text-sm text-fg-muted">{k.pickFile}</p> : (
                  <>
                    {failure && (
                      <Failure file={file.file} test={failure} onOpen={onOpen} running={running} onExplain={() => explain(file, failure)}
                        onRerunTest={() => start(rerunnable(file.file) ? [file.file] : undefined, failure.name)} />
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 pb-1.5">
                        <h3 className="min-w-0 flex-1 truncate font-display text-md font-bold text-fg">{k.testsOf.replace('{file}', file.file)}</h3>
                        {rerunnable(file.file) && !running && (
                          <Button size="sm" variant="ghost" onClick={() => start([file.file])}><RotateCw size={12} /> {k.rerunFile}</Button>
                        )}
                      </div>
                      <ul className="flex flex-col">
                        {(onlyFailed ? file.tests.filter(x => x.status === 'failed') : file.tests).map((test, i) => {
                          const index = failures.indexOf(test)
                          const row = (
                            <>
                              <StatusIcon status={test.status} />
                              <span className={cn('min-w-0 flex-1 truncate font-mono text-sm', test.status === 'skipped' ? 'text-fg-muted' : 'text-fg')}>
                                {test.suite && <span className="text-fg-muted">{test.suite} › </span>}{test.name}
                              </span>
                              <span className="shrink-0 text-xs text-fg-muted">{test.status === 'skipped' ? k.skipped : ms(test.durationMs, lang)}</span>
                            </>
                          )
                          return (
                            <li key={i} className="border-b border-line-subtle last:border-b-0">
                              {index >= 0
                                ? <button type="button" aria-pressed={failure === test} onClick={() => setPickedTest(index)}
                                  className={cn('flex min-h-9 w-full items-center gap-2.5 rounded-md px-1.5 text-left', failure === test ? 'bg-danger-soft' : 'hover:bg-hover')}>{row}</button>
                                : <div className="flex min-h-9 items-center gap-2.5 px-1.5">{row}</div>}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </section>
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
