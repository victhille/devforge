import { useState } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import type { ExpoCheck, ExpoKey, ExpoLog, ExpoProject, ExpoStartOptions, ExpoStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import { errorText } from '@renderer/lib/errors'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import { Segmented } from '@renderer/features/settings/parts'
import Checkbox from '@renderer/components/ui/Checkbox'
import CopyButton from '@renderer/components/ui/CopyButton'
import Kbd from '@renderer/components/ui/Kbd'
import LogBox from '@renderer/components/ui/LogBox'
import Notice from '@renderer/components/ui/Notice'
import { Field, Input } from '@renderer/components/ui/Input'
import AskForgy from '@renderer/features/assistant/AskForgy'
import QrCode from './QrCode'

/** How the next start opens the app: Expo Go or a dev build, the network, the port, the cache */
export function StartOptions({
  app,
  options,
  locked,
  onChange
}: {
  app: ExpoProject
  options: ExpoStartOptions
  locked: boolean
  onChange: (o: ExpoStartOptions) => void
}) {
  const { t } = useI18n()
  const e = t.expoPage
  const [port, setPort] = useState(String(options.port))
  const portOk = Number.isInteger(Number(port)) && Number(port) >= 1024 && Number(port) <= 65535
  return (
    <fieldset disabled={locked} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        {/* Exclusive choices: radio groups (the fieldset turns them off while the server runs) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-secondary" aria-hidden>
            {e.openIn}
          </span>
          <Segmented
            label={e.openIn}
            value={options.target}
            onChange={target => onChange({ ...options, target })}
            items={[
              { value: 'go', label: e.expoGo },
              { value: 'dev', label: e.devBuild }
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-secondary" aria-hidden>
            {e.connection}
          </span>
          <Segmented
            label={e.connection}
            value={options.connection}
            onChange={connection => onChange({ ...options, connection })}
            items={[
              { value: 'lan', label: e.lan },
              { value: 'tunnel', label: e.tunnel },
              { value: 'localhost', label: e.localhost }
            ]}
          />
        </div>
        <Field label={e.port} error={portOk ? undefined : e.portRange} className="w-28">
          <Input
            inputMode="numeric"
            value={port}
            className="font-mono"
            aria-invalid={!portOk}
            onChange={ev => {
              setPort(ev.target.value)
              const n = Number(ev.target.value)
              if (Number.isInteger(n) && n >= 1024 && n <= 65535) onChange({ ...options, port: n })
            }}
            invalid={!portOk}
          />
        </Field>
        <Checkbox checked={options.clear} onChange={clear => onChange({ ...options, clear })} className="min-h-8 text-sm">
          {e.clear}
        </Checkbox>
      </div>
      {locked && <p className="text-xs text-fg-muted">{e.optionsLocked}</p>}
      {options.target === 'dev' && !app.devClient && <p className="text-xs text-warning">{e.devBuildMissing}</p>}
      {options.connection === 'tunnel' && <p className="text-xs text-warning">{e.tunnelNote}</p>}
    </fieldset>
  )
}

const KEYS: ExpoKey[] = ['a', 'w', 'r', 'm', 'j', 's']

/** The server once Metro answers: the QR code, the commands, the log */
export function RunningPanel({ app, status, logs }: { app: ExpoProject; status: ExpoStatus; logs: ExpoLog[] }) {
  const { t } = useI18n()
  const e = t.expoPage
  const toast = useToast()
  const o = status.options
  const label: Record<ExpoKey, string> = { a: e.keyA, w: e.keyW, r: e.keyR, m: e.keyM, j: e.keyJ, s: e.keyS }
  const hint = !o ? '' : o.connection === 'localhost' ? e.scanLocal : o.connection === 'tunnel' ? e.scanTunnel : o.target === 'dev' ? e.scanDev : e.scanGo
  const text = logs.map(l => l.text).join('\n')
  const hasError = logs.some(l => /\berror\b/i.test(l.text))
  const question = () => {
    // Already masked by the main process; fenced, so that Forgy reads it as data
    const tail = logs
      .slice(-60)
      .map(l => l.text)
      .join('\n')
      .slice(-5000)
      .replace(/```/g, "'''")
    return e.explainQuestion
      .replace('{name}', () => app.name)
      .replace('{sdk}', () => String(app.sdk ?? '?'))
      .replace('{log}', () => '```\n' + tail + '\n```')
  }
  const send = (k: ExpoKey) => window.devforge.expo.key(k).catch(err => toast.show({ tone: 'error', title: errorText(err) }))

  return (
    <div className="flex flex-wrap gap-4">
      <Card className="flex w-[260px] shrink-0 flex-col items-center gap-3 p-4">
        {status.url ? (
          <>
            <QrCode text={status.url} label={e.qr.replace('{url}', status.url)} />
            <div className="flex max-w-full items-center gap-1.5">
              <code className="min-w-0 truncate font-mono text-xs text-fg">{status.url}</code>
              <CopyButton text={status.url} title={e.copy} />
            </div>
            <p className="text-center text-xs leading-relaxed text-fg-secondary">{hint}</p>
          </>
        ) : (
          <div className="grid size-[208px] place-items-center rounded-control bg-elevated px-4 text-center text-sm text-fg-secondary">{e.waitingUrl}</div>
        )}
        {/* Always there, so that the change is read out: the QR code has come */}
        <p role="status" className="sr-only">
          {status.url ? e.qrReady : ''}
        </p>
      </Card>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        <section aria-label={e.actions} className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
          {KEYS.map(k => (
            <Button
              key={k}
              variant="secondary"
              className="justify-between"
              // Metro takes no key before it answers
              disabled={status.state !== 'running' || !status.url}
              onClick={() => send(k)}
            >
              {label[k]}
              {/* The letter is for the eye: a screen reader hears the command's name alone */}
              <span aria-hidden>
                <Kbd>{k}</Kbd>
              </span>
            </Button>
          ))}
        </section>
        <LogBox title={e.log} text={text} placeholder="…" />
        {hasError && <AskForgy label={e.explain} question={question} className="self-start" />}
      </div>
    </div>
  )
}

/** `expo install --check` on demand (npx is slow), and `--fix` after a confirmation */
export function VersionsCard({ app }: { app: ExpoProject }) {
  const { t } = useI18n()
  const e = t.expoPage
  const toast = useToast()
  const [result, setResult] = useState<ExpoCheck | null>(null)
  const [busy, setBusy] = useState<'check' | 'fix' | null>(null)

  async function run(kind: 'check' | 'fix') {
    if (kind === 'fix' && !(await confirmDialog(e.fixConfirm))) return
    setBusy(kind)
    try {
      const r = kind === 'check' ? await window.devforge.expo.check(app.id) : await window.devforge.expo.fix(app.id)
      setResult(r)
      if (kind === 'fix' && r.ok) toast.show({ tone: 'success', title: e.fixed })
    } catch (err) {
      toast.show({ tone: 'error', title: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  const sdk = String(app.sdk ?? '?')
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <CardTitle>{e.versions}</CardTitle>
          <p className="text-xs text-fg-muted">{e.versionsHint}</p>
        </div>
        <Button variant="secondary" size="sm" loading={busy === 'check'} disabled={!!busy} onClick={() => run('check')}>
          {busy === 'check' ? e.checking : e.check}
        </Button>
      </div>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 size={15} aria-hidden /> {e.versionsOk.replace('{n}', sdk)}
            </p>
          ) : result.packages.length ? (
            <Notice
              tone="warning"
              title={e.versionsOff.replace('{n}', String(result.packages.length)).replace('{sdk}', sdk)}
              action={
                <Button size="sm" variant="secondary" loading={busy === 'fix'} disabled={!!busy} onClick={() => run('fix')}>
                  {e.fix}
                </Button>
              }
            >
              <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
                {result.packages.map(p => (
                  <li key={p.name}>
                    {p.name} · {e.expected.replace('{installed}', p.installed).replace('{expected}', p.expected)}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice tone="danger" title={e.checkFailed}>
              <LogBox text={result.output} follow={false} className="mt-2" />
            </Notice>
          ))}
      </div>
    </Card>
  )
}

/** Expo asked, in its terminal, to install @expo/ngrok for the tunnel */
export function NgrokNotice() {
  const { t } = useI18n()
  const e = t.expoPage
  const toast = useToast()
  return (
    <Notice
      tone="warning"
      live
      title={e.ngrokTitle}
      action={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.devforge.expo.installNgrok().catch(err => toast.show({ tone: 'error', title: errorText(err) }))}
        >
          <Download size={13} /> {e.ngrokInstall}
        </Button>
      }
    />
  )
}
