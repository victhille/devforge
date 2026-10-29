import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { AuthProvider, NextAuthStatus, NextStatus, SfWriteResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import { Input } from '@renderer/components/ui/Input'
import { Section } from '../symfony/parts'
import { errorText } from '@renderer/lib/errors'

const PROVIDERS: AuthProvider[] = ['github', 'google', 'credentials']
const KEYS: Record<'github' | 'google', { id: string; secret: string; console: string }> = {
  github: { id: 'AUTH_GITHUB_ID', secret: 'AUTH_GITHUB_SECRET', console: 'https://github.com/settings/developers' },
  google: { id: 'AUTH_GOOGLE_ID', secret: 'AUTH_GOOGLE_SECRET', console: 'https://console.cloud.google.com/apis/credentials' }
}

interface Props {
  projectPath: string
  status: NextStatus
  /** Read again when the workshop reloads (after an install) */
  version: unknown
  install: ReactNode
  onWritten: (result: SfWriteResult) => void
}

/** Auth.js: providers, the files DevForge writes, the providers' keys (written, never shown again) */
export default function AuthSection({ projectPath, status, version, install, onWritten }: Props) {
  const { t } = useI18n()
  const n = t.nextjs
  const [auth, setAuth] = useState<NextAuthStatus | null>(null)
  const [chosen, setChosen] = useState<AuthProvider[] | null>(null)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let alive = true
    window.devforge.nextjs.authStatus(projectPath).then(a => {
      if (!alive) return
      setAuth(a)
      setChosen(c => c ?? (a.providers.length ? a.providers : ['credentials']))
    }).catch(err => { if (alive) setError(errorText(err)) })
    return () => { alive = false }
  }, [projectPath, version])

  if (!auth || !chosen) return error ? <p role="alert" className="text-sm text-danger">{error}</p> : null
  const toggle = (p: AuthProvider, on: boolean) => setChosen(list => on ? PROVIDERS.filter(x => x === p || list?.includes(x)) : (list ?? []).filter(x => x !== p))
  const oauth = chosen.filter((p): p is 'github' | 'google' => p !== 'credentials')
  const files = [
    ...(auth.models === 'missing' ? ['~ prisma/schema.prisma (User, Account, Session, VerificationToken)'] : []),
    `${auth.configured ? '~' : '+'} auth.ts`, '+ app/connexion/page.tsx', '+ app/api/moi/route.ts',
    ...(chosen.includes('credentials') ? ['+ app/inscription/page.tsx', '+ app/api/inscription/route.ts'] : []),
    ...(auth.keys.AUTH_SECRET ? [] : ['~ .env.local (AUTH_SECRET)'])
  ]

  async function apply() {
    setError('')
    setBusy(true)
    try {
      onWritten(await window.devforge.nextjs.applyAuth(projectPath, chosen ?? []))
      setAuth(await window.devforge.nextjs.authStatus(projectPath))
    } catch (err) {
      const code = errorText(err)
      setError((n.authErrors as Record<string, string>)[code.split(':')[0]]?.replace('{name}', code.split(':').slice(1).join(':')) ?? code)
    } finally { setBusy(false) }
  }

  async function saveKeys(p: 'github' | 'google') {
    setError('')
    const written = await window.devforge.nextjs.setAuthKeys(projectPath, { [KEYS[p].id]: keys[KEYS[p].id] ?? '', [KEYS[p].secret]: keys[KEYS[p].secret] ?? '' })
    setKeys(k => ({ ...k, [KEYS[p].id]: '', [KEYS[p].secret]: '' }))
    setSaved(n.keysSaved.replace('{n}', String(written.length)))
    setAuth(await window.devforge.nextjs.authStatus(projectPath))
  }

  return (
    <Section title={n.authTitle} help={n.authHelp}>
      {!auth.installed && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3">
          <span className="flex-1 text-sm text-fg">{n.authNotInstalled}</span>
          {install}
        </div>
      )}
      {auth.models === 'conflict' && <p role="alert" className="rounded-xl bg-warning/10 p-3 text-sm text-fg">{n.authErrors.USER_CONFLICT}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">{n.providers}</legend>
        {PROVIDERS.map(p => (
          <Checkbox key={p} checked={chosen.includes(p)} onChange={v => toggle(p, v)}>
            {n.provider[p]} <span className="text-fg-muted">{n.providerHelp[p]}</span>
          </Checkbox>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1 rounded-xl bg-canvas p-3">
        <span className="text-xs text-fg-muted">{t.symfony.willWrite}</span>
        {files.map(f => <code key={f} className={f.startsWith('+') ? 'font-mono text-xs text-success' : 'font-mono text-xs text-warning'}>{f}</code>)}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-fg-muted">{n.authAfter}</span>
        <Button loading={busy} disabled={!auth.installed || !status.libPrisma || auth.models === 'conflict' || !chosen.length} onClick={apply}>{n.authApply}</Button>
      </div>

      {oauth.map(p => (
        <div key={p} role="group" aria-label={n.keysTitle.replace('{name}', n.provider[p])} className="flex flex-col gap-2 border-t border-line-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold text-fg">{n.keysTitle.replace('{name}', n.provider[p])}</h3>
            <span className={auth.keys[KEYS[p].id] && auth.keys[KEYS[p].secret] ? 'text-xs text-success' : 'text-xs text-warning'}>
              {auth.keys[KEYS[p].id] && auth.keys[KEYS[p].secret] ? n.keysSet : n.keysMissing}
            </span>
            <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal(KEYS[p].console)}><ExternalLink size={13} /> {n.keysConsole}</Button>
          </div>
          <p className="text-xs text-fg-muted">{n.keysCallback.replace('{url}', `http://localhost:3000/api/auth/callback/${p}`)}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input aria-label={KEYS[p].id} placeholder={KEYS[p].id} value={keys[KEYS[p].id] ?? ''} onChange={e => setKeys(k => ({ ...k, [KEYS[p].id]: e.target.value }))} className="font-mono" spellCheck={false} autoComplete="off" />
            <Input aria-label={KEYS[p].secret} placeholder={KEYS[p].secret} type="password" value={keys[KEYS[p].secret] ?? ''} onChange={e => setKeys(k => ({ ...k, [KEYS[p].secret]: e.target.value }))} className="font-mono" autoComplete="off" />
            <Button size="sm" variant="secondary" disabled={!keys[KEYS[p].id]?.trim() || !keys[KEYS[p].secret]?.trim()} onClick={() => { void saveKeys(p) }}>{n.keysSave}</Button>
          </div>
        </div>
      ))}
      {saved && <p role="status" className="text-sm text-success">{saved}</p>}
      <p className="text-xs text-fg-muted">{n.keysNote}</p>
    </Section>
  )
}
