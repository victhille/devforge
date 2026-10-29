import { useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card, { CardHeader, CardTitle } from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { generatePassword, generateSecret, generateUuid, type SecretFormat } from './random'
import ToolHelp from '@renderer/components/ui/ToolHelp'

type T = ReturnType<typeof useI18n>['t']['generator']

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { lang } = useI18n()
  return (
    <label className="flex flex-col gap-1.5 text-sm text-fg-muted">
      <span>{label}{lang === 'fr' ? '\u00a0: ' : ': '}<strong className="text-fg-secondary">{value}</strong></span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-52 accent-accent" />
    </label>
  )
}

function ResultRow({ value, onGenerate, label }: { value: string; onGenerate: () => void; label: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <div className="min-h-8 flex-1 break-all rounded-[9px] border border-line bg-canvas px-3 py-1.5 font-mono text-sm text-fg">
        {value || <span className="font-sans text-fg-muted">{t.generator.clickGenerate}</span>}
      </div>
      <IconButton title="Regenerate" onClick={onGenerate}><RefreshCw size={14} /></IconButton>
      {value && <CopyButton text={value} />}
      <Button onClick={onGenerate}>{label}</Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </Card>
  )
}

// ── Password ─────────────────────────────────────────────────────────────────

function PasswordSection({ t }: { t: T }) {
  const [length, setLength] = useState(16)
  const [opts, setOpts] = useState({ upper: true, lower: true, numbers: true, symbols: false })
  const [result, setResult] = useState('')

  const gen = () => setResult(generatePassword(length, opts))
  const checks: { key: keyof typeof opts; label: string }[] = [
    { key: 'upper',   label: t.uppercase },
    { key: 'lower',   label: t.lowercase },
    { key: 'numbers', label: t.numbers },
    { key: 'symbols', label: t.symbols }
  ]

  return (
    <Section title={t.sectionPass}>
      <div className="flex flex-wrap items-end gap-6">
        <Slider label={t.length} value={length} min={8} max={64} onChange={setLength} />
        <div className="flex flex-wrap items-center gap-4">
          {checks.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5 text-fg-secondary">
              <input
                type="checkbox"
                className="accent-accent"
                checked={opts[key]}
                onChange={e => setOpts(o => ({ ...o, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <ResultRow value={result} onGenerate={gen} label={t.generate} />
    </Section>
  )
}

// ── Secret / Token ────────────────────────────────────────────────────────────

function SecretSection({ t }: { t: T }) {
  const [bytes,  setBytes]  = useState(32)
  const [format, setFormat] = useState<SecretFormat>('hex')
  const [result, setResult] = useState('')

  return (
    <Section title={t.sectionSecret}>
      <div className="flex flex-wrap items-end gap-6">
        <Slider label={t.bytes} value={bytes} min={8} max={64} onChange={setBytes} />
        <div className="flex flex-col gap-1.5 text-sm text-fg-muted">
          <span>{t.format}</span>
          <Tabs<SecretFormat>
            value={format}
            onChange={setFormat}
            items={[
              { value: 'hex',    label: t.formatHex },
              { value: 'base64', label: t.formatBase64 },
              { value: 'alpha',  label: t.formatAlpha }
            ]}
          />
        </div>
      </div>
      <ResultRow value={result} onGenerate={() => setResult(generateSecret(bytes, format))} label={t.generate} />
    </Section>
  )
}

// ── UUID ──────────────────────────────────────────────────────────────────────

function UuidSection({ t }: { t: T }) {
  const [results, setResults] = useState<string[]>([])

  return (
    <Section title={t.sectionUuid}>
      <div>
        <Button onClick={() => setResults(prev => [generateUuid(), ...prev.slice(0, 9)])}>{t.generate}</Button>
      </div>
      {results.length > 0 && (
        <div className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle">
          {results.map(u => (
            <div key={u} className="flex items-center justify-between px-3 py-1.5">
              <span className="font-mono text-sm text-fg">{u}</span>
              <CopyButton text={u} />
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const { t } = useI18n()

  return (
    <Page className="max-w-4xl">
      <PageHeader title={t.generator.title} subtitle={t.generator.subtitle} />
      <ToolHelp id="generator" what={t.toolHelp.generator.what} how={t.toolHelp.generator.how} />
      <PasswordSection t={t.generator} />
      <SecretSection   t={t.generator} />
      <UuidSection     t={t.generator} />
    </Page>
  )
}
