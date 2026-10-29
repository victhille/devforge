import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SfApiConfig, SfApiMode, SfEntity, SfOperation, SfWriteResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Section } from './parts'
import { errorText } from '@renderer/lib/errors'

const OPERATIONS: SfOperation[] = ['list', 'show', 'create', 'update', 'delete']
const SECRET = ['password', 'plainPassword', 'token', 'resetToken', 'apiToken']

/** Required fields hidden from the API: creating one cannot work */
const hiddenRequired = (e: SfEntity, hidden: string[]) => [
  ...e.fields.filter(f => !f.nullable && f.type !== 'json' && hidden.includes(f.name)).map(f => f.name),
  ...e.relations.filter(r => r.kind === 'ManyToOne' && !r.nullable && hidden.includes(r.name)).map(r => r.name)
]

/** Same rule as API Platform: snake_case plural (LigneCommande → /api/ligne_commandes) */
export function apiPath(entity: string): string {
  const w = entity.charAt(0).toLowerCase() + entity.slice(1)
  const p = /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|z)$/.test(w) ? w : w + 's'
  return `/api/${p.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}`
}

interface Props {
  entities: SfEntity[]
  onWritten: (result: SfWriteResult) => void
  serverUrl: string | null
  /** Where the dev server usually listens, for "Test" before it runs */
  defaultUrl: string
  load: () => Promise<SfApiConfig | null>
  save: (config: SfApiConfig) => Promise<SfWriteResult>
  /** Symfony only: API Platform is offered next to the JSON controllers */
  platform?: { installed: boolean }
  /** What the chosen mode still lacks, with the button that installs it */
  needs: (mode: SfApiMode) => { text: string; button: ReactNode } | null
  /** Where the JSON routes are written */
  filesNote: string
}

/** Which entities the API exposes, and how (Symfony, Next.js, Laravel) */
export default function ApiSection({ entities, onWritten, serverUrl, defaultUrl, load, save, platform, needs: needsFor, filesNote }: Props) {
  const { t } = useI18n()
  const s = t.symfony
  const navigate = useNavigate()
  const [config, setConfig] = useState<SfApiConfig | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    load().then(c => {
      if (!alive) return
      // Without a saved choice: what API Platform already exposes, the rest off
      setConfig(c ? { ...c, mode: platform ? c.mode : 'json' } : {
        mode: platform?.installed ? 'platform' : 'json',
        entities: Object.fromEntries(entities.map(e => [e.name, {
          operations: e.apiResource ? [...OPERATIONS] : [],
          hidden: e.fields.map(f => f.name).filter(f => SECRET.includes(f))
        }]))
      })
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read again when the entities change
  }, [entities, platform?.installed])

  if (!config) return null
  const entry = (name: string) => config.entities[name] ?? { operations: [], hidden: SECRET }
  const setEntry = (name: string, patch: Partial<{ operations: SfOperation[]; hidden: string[] }>) =>
    setConfig(c => c && { ...c, entities: { ...c.entities, [name]: { ...entry(name), ...patch } } })
  const setMode = (mode: SfApiMode) => setConfig(c => c && { ...c, mode })

  const needs = needsFor(config.mode)

  async function apply() {
    if (!config) return
    setError('')
    setBusy(true)
    try { onWritten(await save(config)) } catch (err) {
      const code = errorText(err)
      setError((s.errors as Record<string, string>)[code.split(':')[0]]?.replace('{name}', code.split(':').slice(1).join(':')) ?? code)
    } finally { setBusy(false) }
  }

  function test(e: SfEntity) {
    const base = (serverUrl ?? defaultUrl).replace(/\/$/, '')
    const q = new URLSearchParams({ method: 'GET', url: base + apiPath(e.name) })
    navigate(`/api-tester?${q}`)
  }

  const modes: { id: SfApiMode; title: string; help: string; hint: string }[] = [
    { id: 'platform', title: 'API Platform', help: s.platformHelp, hint: s.platformHint },
    { id: 'json', title: s.jsonTitle, help: s.jsonHelp, hint: s.jsonHint }
  ]

  return (
    <Section title="API" help={s.apiHelp}>
      {platform && <div role="radiogroup" aria-label={s.apiMode} className="grid gap-3 md:grid-cols-2">
        {modes.map(m => (
          <button key={m.id} role="radio" aria-checked={config.mode === m.id} onClick={() => setMode(m.id)}
            className={cn('flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors',
              config.mode === m.id ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-canvas hover:border-line')}>
            <strong className="text-fg">{m.title}</strong>
            <span className="text-sm text-fg-secondary">{m.help}</span>
            <span className="text-xs text-fg-muted">{m.hint}</span>
          </button>
        ))}
      </div>}

      {needs && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3">
          <span className="flex-1 text-sm text-fg">{needs.text}</span>
          {needs.button}
        </div>
      )}

      {entities.length === 0 ? <EmptyState title={s.noEntities} /> : (
        <ul aria-label={s.apiTable} className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
          <li aria-hidden className="grid grid-cols-[1.6fr_repeat(5,minmax(0,.7fr))_auto] gap-2 bg-canvas px-4 py-2 text-xs text-fg-muted">
            <span>{s.entity}</span>
            {OPERATIONS.map(o => <span key={o}>{s.ops[o]}</span>)}
            <span />
          </li>
          {entities.map(e => {
            const en = entry(e.name)
            return (
              <li key={e.name} aria-label={e.name} className="flex flex-col gap-2 border-t border-line-subtle px-4 py-3">
                <div className="grid grid-cols-[1.6fr_repeat(5,minmax(0,.7fr))_auto] items-center gap-2">
                  <span className="min-w-0">
                    <strong className="text-fg">{e.name}</strong>{' '}
                    <code className="font-mono text-xs text-fg-muted">{en.operations.length ? apiPath(e.name) : s.notExposed}</code>
                  </span>
                  {OPERATIONS.map(o => (
                    <Checkbox key={o} checked={en.operations.includes(o)}
                      onChange={v => setEntry(e.name, { operations: v ? [...en.operations, o] : en.operations.filter(x => x !== o) })}>
                      <span className="sr-only">{`${s.ops[o]} ${e.name}`}</span>
                    </Checkbox>
                  ))}
                  <Button size="sm" variant="ghost" disabled={!en.operations.includes('list')} title={serverUrl ? undefined : s.testNeedsServer} onClick={() => test(e)}>{s.test}</Button>
                </div>
                {en.operations.includes('create') && hiddenRequired(e, en.hidden).length > 0 && (
                  <p className="text-xs text-warning">{s.hiddenRequired.replace('{list}', hiddenRequired(e, en.hidden).join(', '))}</p>
                )}
                {en.operations.length > 0 && e.fields.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-fg-muted">{s.exposedFields}</span>
                    {e.fields.map(f => {
                      const hidden = en.hidden.includes(f.name)
                      return (
                        <button key={f.name} aria-pressed={!hidden}
                          onClick={() => setEntry(e.name, { hidden: hidden ? en.hidden.filter(h => h !== f.name) : [...en.hidden, f.name] })}
                          className={cn('rounded-full border px-2 py-0.5 font-mono',
                            hidden ? 'border-line-subtle text-fg-muted line-through' : 'border-accent/40 bg-accent-soft text-accent')}>
                          {f.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-fg-muted">{config.mode === 'platform' ? `${s.platformDocs} · ${s.platformLinks}` : filesNote}</span>
        <Button loading={busy} disabled={!!needs || !entities.length} onClick={apply}>{s.applyApi}</Button>
      </div>
    </Section>
  )
}
