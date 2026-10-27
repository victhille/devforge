import { Activity, Box, HardDrive } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import Card, { CardHeader, CardTitle } from '@renderer/components/ui/Card'
import { dockerTone, fmtBytes, usageTone, type VPSStats } from '../stats'
import { UsageBar } from './StatCard'
import { useI18n } from '@renderer/i18n/I18nContext'

const TH = 'px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wider text-fg-muted'
const TD = 'px-3 py-1.5'

export function DisksPanel({ disks }: { disks: VPSStats['disks'] }) {
  const v = useI18n().t.vpsDash
  return (
    <Card>
      <CardHeader><CardTitle><HardDrive size={13} /> {v.disks}</CardTitle></CardHeader>
      <div className="flex flex-col gap-4 p-4">
        {disks.map(d => (
          <div key={d.device + d.mount} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-fg">{d.mount}</span>
              <span className={cn('font-semibold', usageTone(d.pct))}>{d.pct}%</span>
            </div>
            <UsageBar pct={d.pct} />
            <span className="text-xs text-fg-muted">{fmtBytes(d.used)} / {fmtBytes(d.total)}</span>
          </div>
        ))}
        {disks.length === 0 && <span className="text-sm text-fg-muted">{v.noDisks}</span>}
      </div>
    </Card>
  )
}

export function ProcessesPanel({ procs }: { procs: VPSStats['procs'] }) {
  const v = useI18n().t.vpsDash
  return (
    <Card className="overflow-hidden">
      <CardHeader><CardTitle><Activity size={13} /> {v.processes}</CardTitle></CardHeader>
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-line-subtle">
          <tr>
            <th className={TH}>{v.user}</th>
            <th className={TH}>PID</th>
            <th className={TH}>CPU%</th>
            <th className={TH}>MEM%</th>
            <th className={TH}>{v.command}</th>
          </tr>
        </thead>
        <tbody>
          {procs.map(p => (
            <tr key={p.pid} className="border-b border-line-subtle last:border-0 hover:bg-elevated">
              <td className={cn(TD, 'text-fg-secondary')}>{p.user}</td>
              <td className={cn(TD, 'font-mono text-xs text-fg-muted')}>{p.pid}</td>
              <td className={cn(TD, 'font-mono', usageTone(p.cpu * 5))}>{p.cpu.toFixed(1)}</td>
              <td className={cn(TD, 'font-mono text-fg-secondary')}>{p.mem.toFixed(1)}</td>
              <td className={cn(TD, 'max-w-48 truncate font-mono text-xs text-fg')}>{p.cmd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function DockerPanel({ containers }: { containers: VPSStats['docker'] }) {
  const n = containers.length
  const v = useI18n().t.vpsDash
  return (
    <Card>
      <CardHeader><CardTitle><Box size={13} /> {n > 1 ? v.dockerMany.replace('{n}', String(n)) : v.dockerOne}</CardTitle></CardHeader>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 p-4">
        {containers.map(c => (
          <div key={c.name} className="flex flex-col gap-1 rounded-lg border border-line-subtle bg-elevated p-3">
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', dockerTone(c.status))} />
              <span className="truncate font-medium text-fg">{c.name}</span>
            </div>
            <span className="truncate font-mono text-xs text-fg-secondary">{c.image}</span>
            <span className="text-xs text-fg-muted">{c.status}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
