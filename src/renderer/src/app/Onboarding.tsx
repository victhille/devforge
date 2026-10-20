import { useEffect, useState } from 'react'
import { Check, Container, Database, FolderSearch, KeyRound, Server } from 'lucide-react'
import type { AppSettings, DetectedProject, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import Spinner from '@renderer/components/ui/Spinner'
import Mascot from '@renderer/features/assistant/Mascot'

const STEPS = 4

/**
 * First launch: projects folder and scan, optional API key, a word about
 * Forgy. Shown once (settings.onboarded), skippable at any step.
 */
export default function Onboarding() {
  const { t } = useI18n()
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

  useEffect(() => { window.devforge.getSettings().then(s => { setSettings(s); setDir(s.defaultProjectsDir) }).catch(() => {}) }, [])
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

  async function saveKey() {
    setKeyError('')
    try { await window.devforge.assistant.saveConfig({ apiKey: key }); setKeySaved(true); setKey(''); setStep(3) }
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
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {features.map(f => (
                  <li key={f.text} className="flex items-start gap-3 rounded-xl border border-line-subtle bg-surface p-3.5 text-[13px] text-fg">
                    <f.icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />{f.text}
                  </li>
                ))}
              </ul>
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
              <div className="flex items-center gap-4">
                <Mascot mood="listening" size={60} followCursor={false} />
                <div>
                  <h2 id="onboarding-title" className="text-xl font-semibold text-fg">{o.forgyTitle}</h2>
                  <p className="mt-1 text-sm text-fg-secondary">{o.forgyText}</p>
                </div>
              </div>
              {added > 0 && <p className="flex items-center gap-2 text-sm text-success"><Check size={15} /> {o.added.replace('{n}', String(added))}</p>}
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

          {step === 3 && (
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
          {step === 2 && <Button variant="secondary" onClick={() => setStep(3)}>{o.later}</Button>}
          {step === 3 && <Button onClick={finish}>{o.go}</Button>}
        </div>
      </div>
    </div>
  )
}
