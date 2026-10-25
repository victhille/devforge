import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { SfCommand, SfMigration } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatDate } from '@renderer/lib/format'
import EmptyState from '@renderer/components/ui/EmptyState'
import { CommandButton, Section } from './parts'

interface Props {
  migrations: SfMigration[]
  databaseOk: boolean
  exec: (command: SfCommand) => void
}

const shortVersion = (v: string) => v.replace(/^DoctrineMigrations\\/, '')

/** Prepared, applied or rolled back: the SQL is always shown before it runs */
export default function MigrationsSection({ migrations, databaseOk, exec }: Props) {
  const { t } = useI18n()
  const s = t.symfony
  const pending = migrations.filter(m => !m.executed)
  const [selected, setSelected] = useState<string | null>(pending[pending.length - 1]?.version ?? migrations[0]?.version ?? null)
  const current = migrations.find(m => m.version === selected) ?? null
  const lastApplied = migrations.find(m => m.executed)

  function confirmed(command: SfCommand) {
    if (command === 'migrations:prev' && !window.confirm(s.rollbackConfirm.replace('{name}', lastApplied ? (lastApplied.description || shortVersion(lastApplied.version)) : ''))) return
    if (command === 'migrations:migrate' && pending.some(m => m.dangerous) && !window.confirm(s.dangerConfirm)) return
    exec(command)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <Section title={s.migrationsTitle} help={s.migrationsHelp}
        actions={<CommandButton command="migrations:diff" label={s.prepare} onRun={exec} disabled={!databaseOk} />}>
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
          <CommandButton command="migrations:prev" label={s.rollback} variant="ghost" onRun={confirmed} disabled={!databaseOk || !lastApplied} />
          <CommandButton command="migrations:migrate" label={s.apply} variant="primary" onRun={confirmed} disabled={!databaseOk || !pending.length} />
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
          </>
        ) : <p className="text-sm text-fg-muted">{s.pickMigration}</p>}
        <p className="text-xs text-fg-muted">{s.migrationsNote}</p>
      </Section>
    </div>
  )
}
