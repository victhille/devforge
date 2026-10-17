import { useState } from 'react'
import { Key, Lock } from 'lucide-react'
import type { SSHAuthMethod, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input } from '@renderer/components/ui/Input'

export const CONNECTION_COLORS = [
  '#4F8EF7', '#3DD68C', '#F5A623', '#F7615A',
  '#A78BFA', '#34D399', '#60A5FA', '#F472B6'
]

interface Props {
  initial?: SSHConnection
  onSave: (conn: SSHConnection) => void
  onCancel: () => void
}

export default function ConnectionForm({ initial, onSave, onCancel }: Props) {
  const { t } = useI18n()
  const [name,       setName]       = useState(initial?.name ?? '')
  const [host,       setHost]       = useState(initial?.host ?? '')
  const [port,       setPort]       = useState(String(initial?.port ?? 22))
  const [username,   setUsername]   = useState(initial?.username ?? '')
  const [authMethod, setAuthMethod] = useState<SSHAuthMethod>(initial?.authMethod ?? 'password')
  const [password,   setPassword]   = useState('')
  const [keyPath,    setKeyPath]    = useState(initial?.privateKeyPath ?? '')
  const [color,      setColor]      = useState(initial?.color ?? CONNECTION_COLORS[0])
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  async function browseKey() {
    const file = await window.devforge.selectFile()
    if (file) setKeyPath(file)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim())     errs.name     = 'Required'
    if (!host.trim())     errs.host     = 'Required'
    if (!username.trim()) errs.username = 'Required'
    const p = parseInt(port, 10)
    if (isNaN(p) || p < 1 || p > 65535) errs.port = 'Invalid port'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function save() {
    if (!validate()) return
    onSave({
      id:             initial?.id ?? crypto.randomUUID(),
      name:           name.trim(),
      host:           host.trim(),
      port:           parseInt(port, 10),
      username:       username.trim(),
      authMethod,
      // Empty password on edit = keep the stored one (handled in main process)
      password:       authMethod === 'password' && password ? password : undefined,
      privateKeyPath: authMethod === 'privateKey' ? keyPath : undefined,
      color,
      createdAt:      initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <Modal
      title={initial ? t.ssh.editConnection : t.ssh.newConnection}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{t.ssh.cancel}</Button>
          <Button onClick={save}>{t.ssh.save}</Button>
        </>
      }
    >
      <Field label={t.ssh.labelName} error={errors.name}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="My VPS" invalid={!!errors.name} autoFocus />
      </Field>

      <div className="flex gap-3">
        <Field label={t.ssh.labelHost} error={errors.host} className="flex-1">
          <Input value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.1" invalid={!!errors.host} />
        </Field>
        <Field label={t.ssh.labelPort} error={errors.port} className="w-24">
          <Input value={port} onChange={e => setPort(e.target.value)} placeholder="22" invalid={!!errors.port} />
        </Field>
      </div>

      <Field label={t.ssh.labelUsername} error={errors.username}>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="root" invalid={!!errors.username} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg-secondary">{t.ssh.labelAuth}</span>
        <Tabs<SSHAuthMethod>
          value={authMethod}
          onChange={setAuthMethod}
          items={[
            { value: 'password',   label: t.ssh.authPassword, icon: <Lock size={13} /> },
            { value: 'privateKey', label: t.ssh.authKey,      icon: <Key size={13} /> }
          ]}
        />
      </div>

      {authMethod === 'password' ? (
        <Field label={t.ssh.labelPassword} hint={initial?.hasPassword ? undefined : 'Stored encrypted by the OS'}>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={initial?.hasPassword ? t.ssh.passwordUnchanged : '••••••••'}
          />
        </Field>
      ) : (
        <Field label={t.ssh.labelKeyPath}>
          <div className="flex gap-2">
            <Input value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className="font-mono" />
            <Button variant="secondary" onClick={browseKey}>{t.ssh.browseKey}</Button>
          </div>
        </Field>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg-secondary">{t.ssh.labelColor}</span>
        <div className="flex gap-2">
          {CONNECTION_COLORS.map(c => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                'size-6 rounded-full transition-transform hover:scale-110',
                color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface'
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}
