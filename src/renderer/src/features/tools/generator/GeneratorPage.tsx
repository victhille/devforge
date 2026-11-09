import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useCopy } from '@renderer/hooks/useCopy'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import { Select } from '@renderer/components/ui/Input'
import Switch from '@renderer/components/ui/Switch'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { generatePassword, generateSecret, generateUuid, laravelAppKey, secretBits, type PasswordOptions, type SecretFormat } from './random'
import ToolHelp from '@renderer/components/ui/ToolHelp'

type T = ReturnType<typeof useI18n>['t']['generator']
type Kind = 'password' | 'secret' | 'uuid'

/** Characters each kind of password draws from (as random.ts): its strength in bits */
const POOL = { upper: 26, lower: 26, numbers: 10, symbols: 26 }
const passwordBits = (length: number, o: PasswordOptions) =>
  Math.floor(length * Math.log2(Math.max(1, (Object.keys(POOL) as (keyof PasswordOptions)[]).reduce((n, k) => n + (o[k] ? POOL[k] : 0), 0))))

/** A setting's row: its name, its control on the right, as in the mock-up */
function Row({ label, children, htmlFor }: { label: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-subtle py-3 last:border-0">
      {htmlFor ? <label htmlFor={htmlFor} className="text-sm font-semibold text-fg">{label}</label> : <span className="text-sm font-semibold text-fg">{label}</span>}
      {children}
    </div>
  )
}

/** The value moves with the knob; it is kept (and a new value drawn) once the knob is let go */
function Slider({ id, label, value, unit, min, max, onChange }: { id: string; label: string; value: number; unit: string; min: number; max: number; onChange: (v: number) => void }) {
  const [shown, setShown] = useState(value)
  useEffect(() => setShown(value), [value])
  const commit = () => { if (shown !== value) onChange(shown) }
  return (
    <div className="flex flex-col gap-2 border-b border-line-subtle pb-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-fg">{label}</label>
        <span className="font-mono text-sm text-fg-secondary">{shown} {unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={shown} onChange={e => setShown(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="w-full accent-accent" />
    </div>
  )
}

/** The two cards: what to draw on the left, what was drawn on the right */
function Layout({ t, settings, result, bits }: { t: T; settings: ReactNode; result: ReactNode; bits: number }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-labelledby="gen-settings" className="df-rise flex flex-col gap-3 rounded-card border border-line-subtle bg-surface p-5">
        <h2 id="gen-settings" className="font-display text-md font-bold text-fg">{t.settings}</h2>
        {settings}
      </section>
      <section aria-labelledby="gen-result" className="df-rise flex flex-col gap-4 rounded-card border border-line-subtle bg-surface p-5" style={{ '--i': 1 } as CSSProperties}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="gen-result" className="font-display text-md font-bold text-fg">{t.result}</h2>
          <Badge color="success"><Check size={12} aria-hidden /> {t.bits.replace('{n}', String(bits))}</Badge>
        </div>
        {result}
        <p className="text-xs text-fg-muted">{t.local}</p>
      </section>
    </div>
  )
}

/** The value drawn, big, Copy (the accent one) and Draw again under it */
function Drawn({ value, t, onRegenerate }: { value: string; t: T; onRegenerate: () => void }) {
  const { copy, copied } = useCopy()
  return (
    <>
      <output className="min-h-24 rounded-card bg-console p-5 font-mono text-xl leading-snug break-all text-fg">{value}</output>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => copy(value)}><Copy size={14} aria-hidden /> {copied ? t.copied : t.copy}</Button>
        <Button variant="secondary" onClick={onRegenerate}><RefreshCw size={14} aria-hidden /> {t.regenerate}</Button>
      </div>
    </>
  )
}

function PasswordTool({ t }: { t: T }) {
  const [length, setLength] = usePersistentState('devforge:gen-pass-length', 16)
  const [opts, setOpts] = usePersistentState<PasswordOptions>('devforge:gen-pass-opts', { upper: true, lower: true, numbers: true, symbols: false })
  const [value, setValue] = useState('')
  const draw = () => setValue(generatePassword(length, opts))
  // A new one as soon as a setting changes
  useEffect(draw, [length, opts])
  const toggles: { key: keyof PasswordOptions; label: string }[] = [
    { key: 'upper', label: t.uppercase }, { key: 'lower', label: t.lowercase },
    { key: 'numbers', label: t.numbers }, { key: 'symbols', label: t.symbols }
  ]
  return (
    <Layout t={t} bits={passwordBits(length, opts)}
      settings={<>
        <Slider id="gen-length" label={t.length} value={length} unit={t.chars} min={8} max={64} onChange={setLength} />
        <div>
          {toggles.map(x => (
            <Row key={x.key} label={x.label}>
              <Switch checked={opts[x.key]} label={x.label} disabled={opts[x.key] && Object.values(opts).filter(Boolean).length === 1} title={t.lastKind}
                onChange={on => setOpts(o => ({ ...o, [x.key]: on }))} />
            </Row>
          ))}
        </div>
      </>}
      result={<Drawn value={value} t={t} onRegenerate={draw} />} />
  )
}

function SecretTool({ t }: { t: T }) {
  const [format, setFormat] = usePersistentState<SecretFormat>('devforge:gen-secret-format', 'base64')
  const [bytes, setBytes] = usePersistentState('devforge:gen-secret-bytes', 32)
  const [laravel, setLaravel] = usePersistentState('devforge:gen-secret-laravel', false)
  const [urlSafe, setUrlSafe] = usePersistentState('devforge:gen-secret-urlsafe', false)
  const [value, setValue] = useState('')
  // Laravel's APP_KEY is always 32 bytes in padded base64
  const asLaravel = format === 'base64' && laravel
  const draw = () => setValue(asLaravel ? laravelAppKey() : generateSecret(bytes, format, { urlSafe: format === 'base64' && urlSafe }))
  useEffect(draw, [format, bytes, laravel, urlSafe]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Layout t={t} bits={asLaravel ? 256 : secretBits(bytes, format)}
      settings={<>
        <div className="flex flex-col gap-2 border-b border-line-subtle pb-4">
          <label htmlFor="gen-format" className="text-sm font-semibold text-fg">{t.format}</label>
          <Select id="gen-format" value={format} onChange={e => setFormat(e.target.value as SecretFormat)}>
            <option value="base64">{t.formatBase64}</option>
            <option value="hex">{t.formatHex}</option>
            <option value="alpha">{t.formatAlpha}</option>
          </Select>
        </div>
        {!asLaravel && <Slider id="gen-bytes" label={t.length} value={bytes} unit={t.bytesUnit} min={8} max={64} onChange={setBytes} />}
        {format === 'base64' && (
          <div>
            <Row label={t.laravelPrefix}><Switch checked={laravel} onChange={setLaravel} label={t.laravelPrefix} /></Row>
            {!laravel && <Row label={t.urlSafe}><Switch checked={urlSafe} onChange={setUrlSafe} label={t.urlSafe} /></Row>}
          </div>
        )}
      </>}
      result={<Drawn value={value} t={t} onRegenerate={draw} />} />
  )
}

function UuidTool({ t }: { t: T }) {
  const [count, setCount] = usePersistentState('devforge:gen-uuid-count', 5)
  const [values, setValues] = useState<string[]>([])
  const draw = () => setValues(Array.from({ length: count }, generateUuid))
  useEffect(draw, [count])
  const { copy, copied } = useCopy()
  return (
    <Layout t={t} bits={122}
      settings={<Slider id="gen-count" label={t.count} value={count} unit="" min={1} max={20} onChange={setCount} />}
      result={<>
        <ul className="flex flex-col divide-y divide-line-subtle rounded-card bg-console px-4 py-1">
          {values.map(u => (
            <li key={u} className="flex items-center justify-between gap-3 py-1.5">
              <span className="font-mono text-sm text-fg">{u}</span>
              <CopyButton text={u} title={t.copyOne.replace('{uuid}', u)} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => copy(values.join('\n'))}><Copy size={14} aria-hidden /> {copied ? t.copied : t.copyAll}</Button>
          <Button variant="secondary" onClick={draw}><RefreshCw size={14} aria-hidden /> {t.regenerate}</Button>
        </div>
      </>} />
  )
}

/**
 * As in the mock-up: a tab per kind of value, its settings on the left, the
 * value already drawn on the right with its strength; it is drawn again as
 * soon as a setting changes. Everything is drawn on this PC.
 */
export default function GeneratorPage() {
  const { t } = useI18n()
  const g = t.generator
  const [kind, setKind] = usePersistentState<Kind>('devforge:gen-kind', 'password')

  return (
    <Page className="df-mockup max-w-none gap-5">
      <PageHeader crumb={t.nav.groupTools} title={g.title} subtitle={g.subtitle} />
      <ToolHelp id="generator" what={t.toolHelp.generator.what} how={t.toolHelp.generator.how} />
      <Tabs<Kind> value={kind} onChange={setKind} label={g.kinds} className="self-start"
        items={[{ value: 'password', label: g.sectionPass }, { value: 'secret', label: g.sectionSecret }, { value: 'uuid', label: g.sectionUuid }]} />
      {kind === 'password' ? <PasswordTool t={g} /> : kind === 'secret' ? <SecretTool t={g} /> : <UuidTool t={g} />}
    </Page>
  )
}
