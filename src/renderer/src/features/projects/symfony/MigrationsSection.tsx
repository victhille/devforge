import { useState } from 'react'
import { AlertTriangle, Bot } from 'lucide-react'
import type { SfMigration } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatDate } from '@renderer/lib/format'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import Button from '@renderer/components/ui/Button'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import { RunButton, Section } from './parts'

/** A migration button: the exact command line it runs, and what it does */
export interface MigrationAction {
  /** Command line shown under the button; with `named`, for the name typed */
  line: (name: string) => string
  run: (name: string) => void
  /** Prisma, Laravel: the migration gets a name, typed before */
  named?: boolean
  /** In place of the usual label */
  label?: string
  /** false: nothing changes in the database yet, no confirmation (Prisma's undoing is prepared, then applied) */
  confirm?: boolean
}

interface Props {
  migrations: SfMigration[]
  databaseOk: boolean
  prepare: MigrationAction
  apply: MigrationAction | null
  rollback: MigrationAction | null
  /** Where the files are, how they are kept */
  note?: string
  help?: string
}

const shortVersion = (v: string) => v.replace(/^DoctrineMigrations\\/, '')

/** Prepared, applied or rolled back: the SQL is always shown before it runs (Symfony, Prisma, Laravel) */
export default function MigrationsSection({ migrations, databaseOk, prepare, apply, rollback, note, help }: Props) {
  const { t } = useI18n()
  const { ask } = useAssistant()
  const s = t.symfony
  const pending = migrations.filter(m => !m.executed)
  const [selected, setSelected] = useState<string | null>(pending[pending.length - 1]?.version ?? migrations[0]?.version ?? null)
  const [name, setName] = useState('modification')
  const current = migrations.find(m => m.version === selected) ?? null
  const lastApplied = migrations.find(m => m.executed)
  const nameOk = !prepare.named || /^[a-z0-9_]{1,60}$/.test(name)

  function doRollback() {
    if (!rollback) return
    if (rollback.confirm !== false && !window.confirm(s.rollbackConfirm.replace('{name}', lastApplied ? (lastApplied.description || shortVersion(lastApplied.version)) : ''))) return
    rollback.run('')
  }
  function doApply() {
    if (!apply || (pending.some(m => m.dangerous) && !window.confirm(s.dangerConfirm))) return
    apply.run('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <Section title={s.migrationsTitle} help={help ?? s.migrationsHelp}
        actions={<div className="flex flex-wrap items-start gap-2">
          {prepare.named && (
            <Input aria-label={s.migrationName} value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} className="h-8 w-40 font-mono text-xs" spellCheck={false} />
          )}
          <RunButton label={prepare.label ?? s.prepare} line={prepare.line(name)} onRun={() => prepare.run(name)} disabled={!databaseOk || !nameOk} />
        </div>}>
        {!databaseOk && <p className="text-sm text-warning">{s.needsDatabase}</p>}
        {migrations.length === 0 ? <EmptyState title={s.noMigrations} description={s.noMigrationsHelp} /> : (
          <ul aria-label={s.migrationsTitle} className="flex flex-col gap-2">
            {migrations.map(m => (
              <li key={m.version}>
                <button onClick={() => setSelected(m.version)} aria-pressed={selected === m.version}
                  className={cn('flex w-full flex-col gap-0.5 rounded-xl border bg-canvas p-3 text-left transition-colors',
                    selected === m.version ? (m.executed ? 'border-accent' : 'border-warning') : 'border-line-subtle hover:border-line')}>
                  <span className="flex items-center gap-2">
                    <span className={m.executed ? 'text-success' : 'text-warning'} aria-hidden>●</span>
                    <strong className="min-w-0 flex-1 truncate text-fg">{m.description || shortVersion(m.version)}</strong>
                    <span className={cn('text-xs', m.executed ? 'text-success' : 'text-warning')}>{m.executed ? s.applied : s.pending}</span>
                  </span>
                  <span className="font-mono text-[11px] text-fg-muted">
                    {shortVersion(m.version)}{m.executedAt ? ` · ${formatDate(m.executedAt.replace(' ', 'T'))}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={current ? s.whatChanges.replace('{name}', current.description || shortVersion(current.version)) : s.sqlTitle}
        actions={<>
          {rollback && <RunButton label={rollback.label ?? s.rollback} line={rollback.line('')} variant="ghost" onRun={doRollback} disabled={!databaseOk || !lastApplied} />}
          {apply && <RunButton label={s.apply} line={apply.line('')} variant="primary" onRun={doApply} disabled={!databaseOk || !pending.length} />}
        </>}>
        {current ? (
          <>
            {current.dangerous && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-fg">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />{s.dangerous}
              </p>
            )}
            <pre tabIndex={0} aria-label={s.sqlTitle} className="max-h-[420px] overflow-auto rounded-xl border border-line-subtle bg-canvas p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg-secondary">
              {current.sql.length ? current.sql.join(';\n') + ';' : s.noSql}
            </pre>
            {current.sql.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" className="border-forgy/30 text-forgy" onClick={() => ask(s.explainMigration
                  .replace('{name}', current.description || shortVersion(current.version))
                  .replace('{state}', current.executed ? s.applied : s.pending)
                  .replace('{sql}', current.sql.join(';\n').slice(0, 6000) + ';'))}>
                  <Bot size={13} /> {s.explainWithForgy}
                </Button>
              </div>
            )}
          </>
        ) : <p className="text-sm text-fg-muted">{s.pickMigration}</p>}
        <p className="text-xs text-fg-muted">{note ?? s.migrationsNote}</p>
      </Section>
    </div>
  )
}
