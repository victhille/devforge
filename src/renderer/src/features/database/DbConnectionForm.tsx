import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, XCircle } from 'lucide-react'
import type { DbConnection, DbType, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input, Select } from '@renderer/components/ui/Input'
import { CONNECTION_COLORS } from '@renderer/features/ssh/components/ConnectionForm'
import { errorText } from '@renderer/lib/errors'

const DEFAULT_PORT: Record<DbType, number | undefined> = { mysql: 3306, postgres: 5432, sqlite: undefined }

interface Props {
  initial?: DbConnection
  onSave: (c: DbConnection) => Promise<void>
  onClose: () => void
}

export default function DbConnectionForm({ initial, onSave, onClose }: Props) {
  const { t } = useI18n()
  const d = t.database
  const [c, setC] = useState<DbConnection>(initial ?? {
    id: crypto.randomUUID(), name: '', type: 'postgres', host: '127.0.0.1', port: 5432, user: '', database: '', color: CONNECTION_COLORS[1]
  })
  const [password, setPassword] = useState('')
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [servers, setServers] = useState<SSHConnection[]>([])

  useEffect(() => { window.devforge.getSshConnections().then(setServers) }, [])

  const set = <K extends keyof DbConnection>(k: K, v: DbConnection[K]) => { setC(x => ({ ...x, [k]: v })); setTest(null) }
  const full = (): DbConnection => ({ ...c, name: c.name.trim() || (c.type === 'sqlite' ? c.file?.split(/[\\/]/).pop() ?? 'SQLite' : `${c.database}@${c.host}`), password: password || undefined })

  async function runTest() {
    setTesting(true)
    try { setTest({ ok: true, text: await window.devforge.db.test(full()) }) }
    catch (err) { setTest({ ok: false, text: errorText(err) }) }
    finally { setTesting(false) }
  }

  async function browse() {
    const f = await window.devforge.selectFile()
    if (f) set('file', f)
  }

  const valid = c.type === 'sqlite' ? !!c.file : !!c.host && !!c.user

  return (
    <Modal
      title={initial ? d.editTitle : d.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={runTest} loading={testing} disabled={!valid} className="mr-auto">{d.test}</Button>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button disabled={!valid} onClick={() => onSave(full())}>{t.common.save}</Button>
        </>
      }
    >
      <Tabs<DbType>
        value={c.type}
        onChange={type => { set('type', type); set('port', DEFAULT_PORT[type]) }}
        items={[{ value: 'postgres', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL / MariaDB' }, { value: 'sqlite', label: 'SQLite' }]}
      />

      <Field label={d.name}>
        <Input value={c.name} onChange={e => set('name', e.target.value)} placeholder={d.namePlaceholder} />
      </Field>

      {c.type === 'sqlite' ? (
        <Field label={d.file}>
          <div className="flex gap-2">
            <Input value={c.file ?? ''} onChange={e => set('file', e.target.value)} className="font-mono text-sm" placeholder="C:\…\database.sqlite" />
            <IconButton title={t.common.browse} onClick={browse}><FolderOpen size={15} /></IconButton>
          </div>
        </Field>
      ) : (
        <>
          <div className="flex gap-3">
            <Field label={d.host} className="flex-1"><Input value={c.host ?? ''} onChange={e => set('host', e.target.value)} /></Field>
            <Field label={d.port} className="w-28"><Input type="number" value={c.port ?? ''} onChange={e => set('port', Number(e.target.value))} /></Field>
          </div>
          <div className="flex gap-3">
            <Field label={d.user} className="flex-1"><Input value={c.user ?? ''} onChange={e => set('user', e.target.value)} /></Field>
            <Field label={d.password} className="flex-1">
              <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setTest(null) }} placeholder={c.hasPassword ? t.ssh.passwordUnchanged : ''} />
            </Field>
          </div>
          <Field label={d.databaseName}><Input value={c.database ?? ''} onChange={e => set('database', e.target.value)} /></Field>
          <Field label={d.viaSsh} hint={c.sshConnectionId ? d.viaSshHint : undefined}>
            <Select value={c.sshConnectionId ?? ''} onChange={e => set('sshConnectionId', e.target.value || undefined)}>
              <option value="">{d.direct}</option>
              {servers.map(s => <option key={s.id} value={s.id}>{s.name} — {s.username}@{s.host}</option>)}
            </Select>
          </Field>
        </>
      )}

      {test && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${test.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
          {test.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
          <span className="font-mono text-xs break-all">{test.text}</span>
        </div>
      )}
    </Modal>
  )
}
