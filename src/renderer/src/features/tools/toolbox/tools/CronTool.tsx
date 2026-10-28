import { useMemo, useState } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Card from '@renderer/components/ui/Card'
import { Input } from '@renderer/components/ui/Input'
import { formatRelative } from '@renderer/lib/format'
import { describeCron, nextRuns, parseCron } from '../lib/cron'
import type { ToolboxT } from '../IoPanel'
import ToolHelp from '@renderer/components/ui/ToolHelp'

const EXAMPLES = ['*/5 * * * *', '0 9 * * 1-5', '30 2 * * *', '0 0 1 * *', '0 */6 * * *', '@weekly']

export default function CronTool({ t }: { t: ToolboxT }) {
  const { lang, t: all } = useI18n()
  const h = all.toolHelp
  const [expr, setExpr] = useState('0 9 * * 1-5')

  const result = useMemo(() => {
    try {
      const c = parseCron(expr)
      return { text: describeCron(c, lang === 'fr' ? 'fr' : 'en'), runs: nextRuns(c, 5) }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }, [expr, lang])

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ToolHelp id="cron" what={h.cron.what} how={h.cron.how} />
      <Input value={expr} onChange={e => setExpr(e.target.value)} aria-label={t.tabCron} className="h-12 font-mono text-lg" spellCheck={false} autoFocus />
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map(e => (
          <button key={e} onClick={() => setExpr(e)} className="rounded-full border border-line-subtle px-2.5 py-0.5 font-mono text-xs text-fg-secondary hover:border-line hover:text-fg">{e}</button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 text-center font-mono text-2xs text-fg-muted">
        {t.cronFields.map(f => <span key={f}>{f}</span>)}
      </div>

      {'error' in result ? (
        <Card className="border-danger/30 bg-danger-soft p-4 text-danger">{result.error}</Card>
      ) : (
        <>
          <Card className="p-4 text-md font-medium text-fg">{result.text}</Card>
          <Card className="divide-y divide-line-subtle">
            <div className="px-4 py-2 text-2xs font-semibold uppercase tracking-widest text-fg-muted">{t.cronNext}</div>
            {result.runs.map(d => (
              <div key={d.getTime()} className="flex justify-between px-4 py-2 text-sm">
                <span className="font-mono text-fg">{d.toLocaleString(lang, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-fg-muted">{formatRelative(d.toISOString(), lang)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
