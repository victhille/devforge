import { useState } from 'react'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import { Input } from '@renderer/components/ui/Input'
import { useI18n } from '@renderer/i18n/I18nContext'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { ToolActions, type ToolboxT } from '../IoPanel'

export default function UuidTool({ t }: { t: ToolboxT }) {
  const [uuids, setUuids] = useState<string[]>([])
  const [count, setCount] = useState(5)
  const h = useI18n().t.toolHelp

  return (
    <>
      <ToolHelp id="uuid" what={h.uuid.what} how={h.uuid.how}
        examples={[{ label: h.uuid.sample, onPick: () => { setCount(3); setUuids(Array.from({ length: 3 }, () => crypto.randomUUID())) } }]} />
      <ToolActions>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          Count
          <Input
            type="number"
            value={count}
            min={1}
            max={20}
            onChange={e => setCount(Math.min(20, Math.max(1, Number(e.target.value))))}
            className="w-20"
          />
        </label>
        <Button onClick={() => setUuids(Array.from({ length: count }, () => crypto.randomUUID()))}>{t.generate}</Button>
      </ToolActions>
      {uuids.length > 0 && (
        <Card className="divide-y divide-line-subtle">
          {uuids.map(u => (
            <div key={u} className="flex items-center justify-between px-4 py-2">
              <span className="font-mono text-sm text-fg">{u}</span>
              <CopyButton text={u} />
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
