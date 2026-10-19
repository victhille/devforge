import { useEffect, useState } from 'react'
import { Archive, ClipboardCopy } from 'lucide-react'
import type { DataInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import { SettingRow, SettingsCard } from './parts'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Data folder, backups (with restore), local log, monitoring history */
export default function DataSettings({ onCopyReport }: { onCopyReport: () => void }) {
  const { t, lang } = useI18n()
  const s = t.settings
  const toast = useToast()
  const [info, setInfo] = useState<DataInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { window.devforge.data.info().then(setInfo).catch(() => {}) }, [])

  const when = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  const reason = (b: DataInfo['backups'][number]) => b.reason === 'manual' ? s.backupManual : b.reason === 'restore' ? s.backupRestore : s.backupFormat.replace('{v}', String(b.version))

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try { await fn() } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) } finally { setBusy(null) }
  }

  return (
    <SettingsCard title={s.nav.data} hint={s.dataHint}>
      <SettingRow label={s.dataDir} hint={info && <span className="font-mono text-xs">{info.dir} · {s.dataDirInfo.replace('{size}', formatSize(info.size)).replace('{v}', String(info.schemaVersion))}</span>}>
        <Button size="sm" variant="secondary" onClick={() => window.devforge.data.openDir()}>{s.openFolder}</Button>
      </SettingRow>
      <div className="border-t border-line-subtle px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <div className="text-[13.5px] font-medium text-fg">{s.backups}</div>
            <div className="mt-[3px] text-[12.5px] text-fg-secondary">{s.backupsHint}</div>
          </div>
          <Button size="sm" variant="secondary" loading={busy === 'backup'}
            onClick={() => run('backup', async () => { setInfo(await window.devforge.data.backup()); toast.show({ tone: 'success', title: s.backupDone }) })}>
            {s.backupNow}
          </Button>
        </div>
        <div className="mt-3 overflow-hidden rounded-[10px] border border-line-subtle">
          {!info?.backups.length && <p className="px-3 py-2.5 text-[13px] text-fg-muted">{s.noBackups}</p>}
          {info?.backups.map((b, i) => (
            <div key={b.name} className={i ? 'flex items-center gap-3 border-t border-line-subtle px-3 py-2.5 text-[13px]' : 'flex items-center gap-3 px-3 py-2.5 text-[13px]'}>
              <Archive size={15} className="shrink-0 text-fg-muted" aria-hidden />
              <span className="flex-1 text-fg">{when(b.at)}</span>
              <span className="font-mono text-[11.5px] text-fg-muted">{reason(b)}</span>
              <Button size="sm" variant="ghost" loading={busy === b.name}
                onClick={() => { if (window.confirm(s.restoreConfirm.replace('{date}', when(b.at)))) run(b.name, () => window.devforge.data.restore(b.name)) }}>
                {s.restore}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <SettingRow label={s.log} hint={s.logHint}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.devforge.data.openLog()}>{s.openLog}</Button>
          <Button size="sm" variant="secondary" onClick={onCopyReport}><ClipboardCopy size={13} /> {s.copyReport}</Button>
        </div>
      </SettingRow>
      <SettingRow danger label={s.clearHistory} hint={s.clearHistoryHint}>
        <Button size="sm" variant="danger" loading={busy === 'history'}
          onClick={() => { if (window.confirm(s.clearHistoryConfirm)) run('history', async () => { await window.devforge.data.clearHistory(); toast.show({ tone: 'success', title: s.historyCleared }) }) }}>
          {s.clearHistoryButton}
        </Button>
      </SettingRow>
    </SettingsCard>
  )
}
