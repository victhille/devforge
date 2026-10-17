import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import { Input } from '@renderer/components/ui/Input'
import { formatRelative } from '@renderer/lib/format'
import type { ToolboxT } from '../IoPanel'

/** Unix seconds, unix ms or any date string Date can parse */
function parseInput(raw: string): Date | null {
  const v = raw.trim()
  if (!v) return null
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v)
    // < 1e11 → seconds (until year 5138), otherwise milliseconds
    return new Date(Math.abs(n) < 1e11 ? n * 1000 : n)
  }
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export default function TimestampTool({ t }: { t: ToolboxT }) {
  const { lang } = useI18n()
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)))
  const date = useMemo(() => parseInput(input), [input])

  const rows: [string, string][] = date ? [
    [t.tsUnix,     String(Math.floor(date.getTime() / 1000))],
    [t.tsMillis,   String(date.getTime())],
    ['ISO 8601',   date.toISOString()],
    [t.tsLocal,    date.toLocaleString(lang, { dateStyle: 'full', timeStyle: 'medium' })],
    ['UTC',        date.toUTCString()],
    ['RFC 2822 / HTTP', date.toUTCString().replace('GMT', '+0000')],
    [t.tsRelative, formatRelative(date.toISOString(), lang)]
  ] : []

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="1729156800 · 2026-10-17T09:00:00Z" className="h-12 font-mono text-lg" spellCheck={false} />
        <Button variant="secondary" size="lg" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}><Clock size={15} /> {t.tsNow}</Button>
      </div>
      {!date ? (
        input.trim() && <Card className="border-danger/30 bg-danger-soft p-4 text-danger">{t.invalid}</Card>
      ) : (
        <Card className="divide-y divide-line-subtle">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-4 px-4 py-2.5">
              <span className="w-40 shrink-0 text-sm text-fg-muted">{label}</span>
              <span className="flex-1 font-mono text-sm text-fg">{value}</span>
              <CopyButton text={value} />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
