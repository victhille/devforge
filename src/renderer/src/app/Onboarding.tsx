import { useEffect, useState } from 'react'
import { Check, Container, Database, FolderSearch, KeyRound, Plug, Server } from 'lucide-react'
import type { AppLanguage, AppSettings, ConnectionsOverview, DetectedProject, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { docsUrl, openDocs } from '@renderer/lib/docs'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import Spinner from '@renderer/components/ui/Spinner'
import Mascot from '@renderer/features/assistant/Mascot'
import { Segmented } from '@renderer/features/settings/parts'

const STEPS = 5

/**
 * First launch: language, projects folder and scan, accounts (Git identity,
 * GitHub), optional API key, a word about Forgy. Shown once
 * (settings.onboarded), skippable at any step; nothing is set up in advance.
 */
export default function Onboarding() {
  const { t, lang, setLang } = useI18n()
  const o = t.onboarding
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState('')
  const [found, setFound] = useState<DetectedProject[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(false)
  const [added, setAdded] = useState(0)
  const [key, setKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [accounts, setAccounts] = useState<ConnectionsOverview | null>(null)
  const [identity, setIdentity] = useState({ name: '', email: '' })
  const [ghToken, setGhToken] = useState('')
  const [accountsError, setAccountsError] = useState('')

  useEffect(() => { window.devforge.getSettings().then(s => { setSettings(s); setDir(s.defaultProjectsDir) }).catch(() => {}) }, [])
  // What is already there on this PC (GitHub CLI, Git's identity): shown, not asked again
  useEffect(() => {
    if (settings?.onboarded !== false) return
    // It can come after the user typed: what was typed stays
    window.devforge.connections.overview().then(a => {
      setAccounts(a)
      setIdentity(i => (i.name || i.email ? i : { name: a.git.name ?? '', email: a.git.email ?? '' }))
    }).catch(() => {})
  }, [settings?.onboarded])
  if (!settings || settings.onboarded !== false) return null

  async function finish() {
    const next = { ...settings!, onboarded: true, defaultProjectsDir: dir || settings!.defaultProjectsDir }
    await window.devforge.saveSettings(next)
    setSettings(next)
  }

  async function scan(folder = dir) {
    if (!folder) return
    setScanning(true)
    try {
      const saved = new Set((await window.devforge.getProjects()).map(p => p.path))
      // Only folders recognized as projects (a framework or a package manifest)
      const list = (await window.devforge.scanDirectory(folder)).filter(p => !saved.has(p.path) && p.framework !== 'unknown')
      setFound(list)
      setPicked(new Set(list.map(p => p.path)))
    } catch { setFound([]) }
    finally { setScanning(false) }
  }

  async function addProjects() {
    const now = new Date().toISOString()
    const list = (found ?? []).filter(p => picked.has(p.path))
    for (const dp of list) {
      const project: Project = { id: crypto.randomUUID(), name: dp.name, path: dp.path, framework: dp.framework, packageManager: dp.packageManager, createdAt: now, lastOpenedAt: null, favorite: false }
      await window.devforge.saveProject(project)
    }
    setAdded(list.length)
    await window.devforge.saveSettings({ ...settings!, defaultProjectsDir: dir })
    setStep(2)
  }

  async function chooseLanguage(l: AppLanguage) {
    setLang(l)
    const next = { ...settings!, language: l }
    setSettings(next)
    await window.devforge.saveSettings(next)
  }

  /** Git identity and GitHub token, when typed; both can wait for Settings › Connections */
  async function saveAccounts() {
    setAccountsError('')
    const errors = t.settings.connections.errors as Record<string, string>
    try {
      if (identity.name.trim() && identity.email.trim() && (identity.name !== accounts?.git.name || identity.email !== accounts?.git.email)) {
        await window.devforge.connections.setGitIdentity(identity.name, identity.email)
      }
      if (ghToken.trim()) { await window.devforge.github.saveToken(ghToken.trim()); setGhToken('') }
      setStep(3)
    } catch (err) {
      const code = String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      setAccountsError(errors[code] ?? code)
    }
  }

  async function saveKey() {
    setKeyError('')
    try { await window.devforge.assistant.saveConfig({ apiKey: key }); setKeySaved(true); setKey(''); setStep(4) }
    catch (err) { setKeyError(String(err instanceof Error ? err.message : err)) }
  }

  const features = [
    { icon: FolderSearch, text: o.featureProjects },
    { icon: Container, text: o.featureDocker },
    { icon: Database, text: o.featureData },
    { icon: Server, text: o.featureServers }
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title"
        className="df-pop flex max-h-[calc(100vh-48px)] w-[min(680px,100%)] flex-col overflow-hidden rounded-[20px] border border-line bg-elevated shadow-2xl">
        <div className="flex items-center gap-3 px-6 pt-5">
          <div role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={o.progress.replace('{n}', String(step + 1)).replace('{t}', String(STEPS))} className="flex flex-1 gap-1.5">
            {Array.from({ length: STEPS }, (_, i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-active')} />)}
          </div>
          {step < STEPS - 1 && <button onClick={finish} className="text-xs text-fg-muted hover:text-fg">{o.skip}</button>}
        </div>

        <div key={step} className="df-rise flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-5 pb-2">
          {step === 0 && (
            <>
              <div className="flex items-center gap-4">
                <Mascot mood="happy" size={72} followCursor={false} />
                <div>
                  <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-fg">{o.welcomeTitle}</h2>
                  <p className="mt-1 text-sm text-fg-secondary">{o.welcomeText}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] text-fg-secondary">{o.language}</span>
                <Segmented<AppLanguage> label={o.language} value={lang} onChange={chooseLanguage} items={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
              </div>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {features.map(f => (
                  <li key={f.text} className="flex items-start gap-3 rounded-xl border border-line-subtle bg-surface p-3.5 text-[13px] text-fg">
                    <f.icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />{f.text}
                  </li>
                ))}
              </ul>
              {docsUrl('getting-started/first-launch', lang) && (
                <button type="button" onClick={() => openDocs('getting-started/first-launch', lang)} className="self-start text-[13px] text-accent hover:underline">{o.guide}</button>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 id="onboarding-title" className="text-xl font-semibold text-fg">{o.projectsTitle}</h2>
                <p className="mt-1 text-sm text-fg-secondary">{o.projectsText}</p>
              </div>
              <div className="flex gap-2">
                <Input value={dir} onChange={e => setDir(e.target.value)} aria-label={t.settings.defaultDir} className="font-mono text-[12.5px]" />
                <Button variant="secondary" onClick={async () => { const d = await window.devforge.selectDirectory(); if (d) { setDir(d); scan(d) } }}>{t.settings.browse}</Button>
                <Button onClick={() => scan()} loading={scanning}>{o.scan}</Button>
              </div>
              {scanning && <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {o.scanning}</p>}
              {found && !scanning && (found.length === 0 ? <p className="text-sm text-fg-muted">{o.noneFound}</p> : (
                <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-line-subtle">
                  <div className="flex items-center gap-2 border-b border-line-subtle bg-surface px-3 py-2 text-xs text-fg-secondary">
                    <span className="flex-1">{o.found.replace('{n}', String(found.length))}</span>
                    <button className="text-accent hover:underline" onClick={() => setPicked(picked.size === found.length ? new Set() : new Set(found.map(p => p.path)))}>
                      {picked.size === found.length ? o.none : o.all}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {found.map(p => (
                      <label key={p.path} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-hover">
                        <input type="checkbox" checked={picked.has(p.path)} className="accent-[var(--color-accent)]"
                          onChange={e => { const n = new Set(picked); if (e.target.checked) n.add(p.path); else n.delete(p.path); setPicked(n) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-fg">{p.name}</span>
                          <span className="block truncate font-mono text-[11px] text-fg-muted">{p.path}</span>
                        </span>
                        <span className="rounded-full bg-active px-2 py-0.5 font-mono text-[10.5px] text-fg-secondary">{p.framework}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 id="onboarding-title" className="text-xl font-semibold text-fg">{o.accountsTitle}</h2>
                <p className="mt-1 text-sm text-fg-secondary">{o.accountsText}</p>
              </div>
              {added > 0 && <p className="flex items-center gap-2 text-sm text-success"><Check size={15} /> {o.added.replace('{n}', String(added))}</p>}
              <div className="flex flex-col gap-2 rounded-xl border border-line-subtle bg-surface p-4">
                <span className="text-[13.5px] font-medium text-fg">{t.settings.connections.gitIdentity}</span>
                <div className="flex flex-wrap gap-2">
                  <Input aria-label={t.settings.connections.gitName} placeholder={t.settings.connections.gitName} value={identity.name} onChange={e => setIdentity(i => ({ ...i, name: e.target.value }))} className="flex-[1_1_160px]" />
                  <Input aria-label={t.settings.connections.gitEmail} placeholder={t.settings.connections.gitEmail} type="email" value={identity.email} onChange={e => setIdentity(i => ({ ...i, email: e.target.value }))} className="flex-[1_1_200px]" />
                </div>
                <p className="text-xs text-fg-muted">{t.settings.connections.gitIdentityHint}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-line-subtle bg-surface p-4">
                <span className="text-[13.5px] font-medium text-fg">GitHub</span>
                {accounts?.github.cli
                  ? <p className="flex items-center gap-2 text-sm text-success"><Check size={15} /> {t.settings.connections.githubCli.replace('{login}', accounts.github.cli)}</p>
                  : accounts?.github.token
                    ? <p className="flex items-center gap-2 text-sm text-success"><Check size={15} /> {t.settings.connections.tokenSaved}</p>
                    : <Input type="password" aria-label={t.settings.connections.githubToken} placeholder={o.githubTokenPlaceholder} value={ghToken} onChange={e => setGhToken(e.target.value)} className="font-mono" autoComplete="off" />}
                <p className="text-xs text-fg-muted">{t.settings.connections.githubHint}</p>
              </div>
              <p className="flex items-start gap-2 text-xs text-fg-muted"><Plug size={14} className="mt-px shrink-0" /> {o.moreLater}</p>
              {accountsError && <p role="alert" className="text-xs text-danger">{accountsError}</p>}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center gap-4">
                <Mascot mood="listening" size={60} followCursor={false} />
                <div>
                  <h2 id="onboarding-title" className="text-xl font-semibold text-fg">{o.forgyTitle}</h2>
                  <p className="mt-1 text-sm text-fg-secondary">{o.forgyText}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-line-subtle bg-surface p-4">
                <label htmlFor="onboarding-key" className="text-[13.5px] font-medium text-fg">{t.assistant.apiKey}</label>
                <div className="flex gap-2">
                  <Input id="onboarding-key" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={t.assistant.apiKeyPlaceholder} className="font-mono" autoComplete="off" />
                  <Button disabled={!key.trim()} onClick={saveKey}><KeyRound size={14} /> {t.assistant.saveKey}</Button>
                </div>
                <p className="text-xs text-fg-muted">{o.keyHint}</p>
                {keyError && <p className="text-xs text-danger">{keyError}</p>}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex items-center gap-4">
                <Mascot mood="happy" size={64} followCursor={false} />
                <div>
                  <h2 id="onboarding-title" className="text-xl font-semibold text-fg">{o.doneTitle}</h2>
                  <p className="mt-1 text-sm text-fg-secondary">{keySaved ? o.doneWithKey : o.doneNoKey}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-[13px] text-fg">
                {[[o.tipPalette, 'Ctrl K'], [o.tipForgy, 'Ctrl J'], [o.tipSettings, '']].map(([text, kbd]) => (
                  <li key={text} className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface px-3.5 py-3">
                    <span className="flex-1">{text}</span>
                    {kbd && <kbd className="rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-xs text-fg-secondary">{kbd}</kbd>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pt-4 pb-5">
          {step > 0 && step < STEPS - 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{o.back}</Button>}
          <span className="flex-1" />
          {step === 0 && <Button onClick={() => { setStep(1); if (!found) scan() }}>{o.start}</Button>}
          {step === 1 && (picked.size > 0 && found?.length
            ? <Button onClick={addProjects}>{o.addProjects.replace('{n}', String(picked.size))}</Button>
            : <Button onClick={async () => { await window.devforge.saveSettings({ ...settings, defaultProjectsDir: dir }); setStep(2) }}>{o.next}</Button>)}
          {step === 2 && <Button onClick={saveAccounts}>{o.next}</Button>}
          {step === 3 && <Button variant="secondary" onClick={() => setStep(4)}>{o.later}</Button>}
          {step === 4 && <Button onClick={finish}>{o.go}</Button>}
        </div>
      </div>
    </div>
  )
}
