import { useEffect, useState } from 'react'
import { AlertTriangle, Archive, ClipboardCopy, Download, FolderOpen, Trash2, Upload } from 'lucide-react'
import type { DataInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { SettingRow, SettingsCard } from './parts'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'

/** Storage (data folder, local log, monitoring history), backups, export and import, then erasing everything */
export default function DataSettings({ onCopyReport }: { onCopyReport: () => void }) {
  const { t, lang } = useI18n()
  const s = t.settings
  const toast = useToast()
  const [info, setInfo] = useState<DataInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [wiping, setWiping] = useState(false)
  const [wipeWord, setWipeWord] = useState('')
  useEffect(() => { window.devforge.data.info().then(setInfo).catch(() => {}) }, [])

  const when = (iso: string) => {
    const d = new Date(iso)
    return `${new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d)} · ${new Intl.DateTimeFormat(lang, { timeStyle: 'short' }).format(d)}`
  }
  const reason = (b: DataInfo['backups'][number]) => b.reason === 'manual' ? s.backupManual : b.reason === 'restore' ? s.backupRestore : s.backupFormat.replace('{v}', String(b.version))
  const typed = wipeWord.trim().toLowerCase() === s.wipeWord

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try { await fn() } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) } finally { setBusy(null) }
  }

  return (
    <>
      <SettingsCard title={s.groups.storage}>
        <SettingRow label={s.dataDir} hint={info && <span className="font-mono text-sm break-all">{info.dir}</span>}>
          <div className="flex flex-wrap items-center gap-2">
            {info && <Badge mono>{s.dataDirInfo.replace('{size}', formatSize(info.size)).replace('{v}', String(info.schemaVersion))}</Badge>}
            <Button size="sm" variant="secondary" onClick={() => window.devforge.data.openDir()}><FolderOpen size={13} /> {s.openFolder}</Button>
          </div>
        </SettingRow>
        <SettingRow label={s.log} hint={s.logHint}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => window.devforge.data.openLog()}>{s.openLog}</Button>
            <Button size="sm" variant="ghost" onClick={onCopyReport}><ClipboardCopy size={13} /> {s.copyReport}</Button>
          </div>
        </SettingRow>
        <SettingRow label={s.clearHistory} hint={s.clearHistoryHint}>
          <Button size="sm" variant="ghost" loading={busy === 'history'}
            onClick={async () => { if ((await confirmDialog(s.clearHistoryConfirm, { danger: true }))) run('history', async () => { await window.devforge.data.clearHistory(); toast.show({ tone: 'success', title: s.historyCleared }) }) }}>
            {s.clearHistoryButton}
          </Button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={s.backups} hint={s.backupsHint} action={
        <Button size="sm" loading={busy === 'backup'}
          onClick={() => run('backup', async () => { setInfo(await window.devforge.data.backup()); toast.show({ tone: 'success', title: s.backupDone }) })}>
          {busy !== 'backup' && <Archive size={13} />} {s.backupNow}
        </Button>
      }>
        {!info?.backups.length && <p className="border-t border-line-subtle px-5 py-3.5 text-sm text-fg-muted">{s.noBackups}</p>}
        {!!info?.backups.length && (
          <ul aria-label={s.backups}>
            {info.backups.map(b => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 border-t border-line-subtle px-5 py-2.5">
                <span className="min-w-[160px] flex-1 font-mono text-sm text-fg">{when(b.at)}</span>
                <Badge color={b.reason === 'manual' ? 'default' : 'info'}>{reason(b)}</Badge>
                <span className="w-16 text-right font-mono text-xs text-fg-muted">{formatSize(b.size)}</span>
                <Button size="sm" variant="ghost" loading={busy === b.name} aria-label={`${s.restore} · ${when(b.at)}`}
                  onClick={async () => { if ((await confirmDialog(s.restoreConfirm.replace('{date}', when(b.at)), { danger: true }))) run(b.name, () => window.devforge.data.restore(b.name)) }}>
                  {s.restore}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard title={s.exportTitle}>
        <SettingRow label={s.exportRow} hint={s.exportHint}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={busy === 'export'}
              onClick={() => run('export', async () => { const file = await window.devforge.data.exportConfig(); if (file) toast.show({ tone: 'success', title: s.exported, description: file }) })}>
              <Download size={13} /> {s.exportButton}
            </Button>
            <Button size="sm" variant="ghost" loading={busy === 'import'}
              onClick={async () => { if ((await confirmDialog(s.importConfirm, { danger: true }))) run('import', async () => { await window.devforge.data.importConfig() }) }}>
              <Upload size={13} /> {s.importButton}
            </Button>
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard danger title={s.dangerZone} icon={<AlertTriangle size={16} className="text-danger" aria-hidden />}>
        <SettingRow label={s.wipeTitle} hint={s.wipeHint}>
          {!wiping ? (
            <Button size="sm" variant="danger" onClick={() => setWiping(true)}>{s.wipeStart}</Button>
          ) : (
            // Typed on purpose: everything goes, and there is no way back
            <form className="flex flex-wrap items-center gap-2" onSubmit={e => {
              e.preventDefault()
              if (!typed) return
              // The page's own memory too: snippets, panels, last version seen
              localStorage.clear()
              sessionStorage.clear()
              run('wipe', () => window.devforge.data.wipe())
            }}>
              <Input aria-label={s.wipeType.replace('{word}', s.wipeWord)} placeholder={s.wipeType.replace('{word}', s.wipeWord)} value={wipeWord}
                onChange={e => setWipeWord(e.target.value)} className="w-64" autoComplete="off" spellCheck={false} autoFocus />
              <Button type="submit" size="sm" variant="danger" loading={busy === 'wipe'} disabled={!typed}>
                <Trash2 size={13} /> {s.wipeButton}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setWiping(false); setWipeWord('') }}>{t.common.cancel}</Button>
            </form>
          )}
        </SettingRow>
      </SettingsCard>
    </>
  )
}
