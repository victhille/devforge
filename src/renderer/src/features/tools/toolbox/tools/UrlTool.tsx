import { useMemo, useState } from 'react'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

export default function UrlTool({ t }: { t: ToolboxT }) {
  const [input, setInput] = useState('https://shop.test/search?q=caf%C3%A9%20cr%C3%A8me&page=2&tags=a&tags=b#results')
  const [output, setOutput] = useState('')

  const parsed = useMemo(() => {
    try { return new URL(input.trim()) } catch { return null }
  }, [input])

  function run(fn: (s: string) => string) {
    try { setOutput(fn(input)) } catch { setOutput(t.invalid) }
  }

  return (
    <>
      <IoGrid>
        <IoPanel label={t.input}>
          <textarea className={IO_TEXTAREA} value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
        </IoPanel>
        <IoPanel label={t.output} actions={output && <CopyButton text={output} />}>
          <textarea className={IO_TEXTAREA} value={output} readOnly spellCheck={false} />
        </IoPanel>
      </IoGrid>
      <ToolActions>
        <Button onClick={() => run(encodeURIComponent)}>{t.encode}</Button>
        <Button variant="secondary" onClick={() => run(decodeURIComponent)}>{t.decode}</Button>
        <Button variant="ghost" onClick={() => run(encodeURI)}>encodeURI</Button>
      </ToolActions>

      {parsed && (
        <Card className="divide-y divide-line-subtle">
          {([
            ['protocol', parsed.protocol], ['host', parsed.host], ['pathname', decodeURIComponent(parsed.pathname)], ['hash', parsed.hash]
          ] as const).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-2 font-mono text-sm">
              <span className="w-28 shrink-0 text-fg-muted">{k}</span><span className="text-fg">{v}</span>
            </div>
          ))}
          {[...parsed.searchParams.entries()].map(([k, v], i) => (
            <div key={`${k}-${i}`} className="flex items-center gap-4 px-4 py-2 font-mono text-sm">
              <span className="w-28 shrink-0 text-accent">?{k}</span>
              <span className="flex-1 break-all text-fg">{v}</span>
              <CopyButton text={v} />
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
