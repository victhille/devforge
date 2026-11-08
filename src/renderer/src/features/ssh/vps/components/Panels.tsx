import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Card, { CardHeader, CardTitle } from '@renderer/components/ui/Card'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { dockerTone, fmtBytes, usageTone, type VPSStats } from '../stats'
import { UsageBar } from './StatCard'
import { useI18n } from '@renderer/i18n/I18nContext'

export function DisksPanel({ disks }: { disks: VPSStats['disks'] }) {
  const v = useI18n().t.vpsDash
  return (
    <Card>
      <CardHeader><CardTitle>{v.disks}</CardTitle></CardHeader>
      <div className="flex flex-col gap-4 p-4">
        {disks.map(d => (
          <div key={d.device + d.mount} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-mono text-fg">{d.mount}</span>
              <span className={cn('font-mono font-semibold', usageTone(d.pct))}>{d.pct} %</span>
            </div>
            <UsageBar pct={d.pct} />
            <span className="font-mono text-xs text-fg-muted">{fmtBytes(d.used)} / {fmtBytes(d.total)}</span>
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
      <CardHeader><CardTitle>{v.processes}</CardTitle></CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>{v.user}</Th>
            <Th>PID</Th>
            <Th align="right">CPU %</Th>
            <Th align="right">MEM %</Th>
            <Th>{v.command}</Th>
          </tr>
        </thead>
        <tbody>
          {procs.map(p => (
            <tr key={p.pid}>
              <Td className="text-fg-secondary">{p.user}</Td>
              <Td className="font-mono text-xs text-fg-muted">{p.pid}</Td>
              <Td align="right" className={cn('font-mono', usageTone(p.cpu * 5))}>{p.cpu.toFixed(1)}</Td>
              <Td align="right" className="font-mono text-fg-secondary">{p.mem.toFixed(1)}</Td>
              <Td className="w-full max-w-0 truncate font-mono text-xs text-fg" title={p.cmd}>{p.cmd}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

export function DockerPanel({ containers }: { containers: VPSStats['docker'] }) {
  const n = containers.length
  const up = containers.filter(c => c.status.toLowerCase().startsWith('up')).length
  const { t } = useI18n()
  const v = t.vpsDash
  if (n === 0) return null
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{v.containers}</CardTitle>
        {n > 0 && <Badge color={up === n ? 'success' : 'warning'}>{v.containersUp.replace('{r}', String(up)).replace('{t}', String(n))}</Badge>}
      </CardHeader>
      <Table>
        <thead>
          <tr><Th>{t.ssh.labelName}</Th><Th>{v.image}</Th><Th>{v.since}</Th></tr>
        </thead>
        <tbody>
          {containers.map(c => (
            <tr key={c.name}>
              <Td>
                <span className="flex items-center gap-2 font-medium text-fg">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', dockerTone(c.status))} />
                  <span className="truncate">{c.name}</span>
                </span>
              </Td>
              <Td className="max-w-72 truncate font-mono text-xs text-fg-muted" title={c.image}>{c.image}</Td>
              <Td className="text-fg-secondary">{c.status}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
