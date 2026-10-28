import { useEffect, useState } from 'react'
import { Code2, Play, Terminal } from 'lucide-react'
import type { DefaultIDE, Project, SubProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import type { PreferredIde } from '@renderer/lib/ide'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import ProjectEnvEditor from '@renderer/features/envfiles/ProjectEnvEditor'
import ProjectIcon from './components/ProjectIcon'
import FileTree from './components/FileTree'
import SymfonyPanel from './symfony/SymfonyPanel'
import NextPanel from './nextjs/NextPanel'
import LaravelPanel from './laravel/LaravelPanel'
import IdeSelect from './components/IdeSelect'

type SubTab = 'scripts' | 'workshop' | 'env' | 'files'

/** The framework workshop a project of the group gets, as on its own page */
const WORKSHOP: Partial<Record<string, (path: string) => JSX.Element>> = {
  symfony: path => <SymfonyPanel projectPath={path} />,
  nextjs: path => <NextPanel projectPath={path} />,
  laravel: path => <LaravelPanel projectPath={path} />
}

/** The script a "run everything" starts in each project */
const devScript = (scripts: Record<string, string>) => ['dev', 'start', 'serve'].find(s => s in scripts) ?? null

function SubPanel({ group, sub, scripts, ide, onIde }: { group: Project; sub: SubProject; scripts: Record<string, string>; ide: PreferredIde; onIde: (next: DefaultIDE | undefined) => void }) {
  const { t } = useI18n()
  const h = t.hub
  const { runScript } = useConsole()
  // Its own IDE, else the group's
  const own = group.subIdes?.[sub.name] ?? group.ide
  const ideLabel = ide.labelFor(own)
  const [tab, setTab] = useState<SubTab>('scripts')
  const workshop = WORKSHOP[sub.framework]
  const tabs: SubTab[] = ['scripts', ...(workshop ? ['workshop' as const] : []), 'env', 'files']
  const label = (x: SubTab) => x === 'scripts' ? h.scripts : x === 'workshop' ? h.tabs[sub.framework as 'symfony'] : h.tabs[x]
  const run = (name: string) => runScript(sub.path, name, sub.packageManager, `${group.name}/${sub.name}`)
  const list = Object.entries(scripts)

  return (
    // A workshop, the .env or the files take the whole width
    <Card className={cn('flex min-w-0 flex-col overflow-hidden', tab !== 'scripts' && 'col-span-full')}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <ProjectIcon framework={sub.framework} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-fg">{sub.name}</h3>
          <div className="truncate font-mono text-[11.5px] text-fg-muted" title={sub.path}>{FRAMEWORK_LABEL[sub.framework] ?? sub.framework} · {sub.packageManager}</div>
        </div>
        <IdeSelect ide={ide} value={group.subIdes?.[sub.name]} label={h.subIde.replace('{name}', sub.name)} onChange={onIde} />
        {ideLabel && <Button size="sm" variant="secondary" onClick={() => ide.open(sub.path, own)}><Code2 size={13} /> {ideLabel}</Button>}
        <IconButton title={h.openTerminal} onClick={() => window.devforge.openTerminal(sub.path)}><Terminal size={14} /></IconButton>
      </div>
      <div role="tablist" aria-label={sub.name} className="flex gap-1 overflow-x-auto border-b border-line px-3">
        {tabs.map(x => (
          <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={cn('h-9 shrink-0 border-b-2 px-3 text-[12.5px] font-medium transition-colors',
              tab === x ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')}>
            {label(x)}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === 'scripts' && (list.length === 0
          ? <p className="px-1 py-2 text-sm text-fg-muted">{h.groupNoScripts}</p>
          : <div className="flex flex-col gap-1.5">
              {list.map(([name, cmd]) => (
                <div key={name} className="flex items-center gap-3 rounded-[9px] bg-elevated px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12.5px] font-medium text-fg">{name}</div>
                    <div className="truncate font-mono text-2xs text-fg-muted">{cmd}</div>
                  </div>
                  <IconButton size="sm" title={`${h.run} ${name}`} onClick={() => run(name)} className="text-success hover:bg-success-soft hover:text-success"><Play size={12} /></IconButton>
                </div>
              ))}
            </div>)}
        {tab === 'workshop' && workshop?.(sub.path)}
        {tab === 'env' && <ProjectEnvEditor projectPath={sub.path} onEnvChange={() => {}} />}
        {tab === 'files' && <div className="h-[480px] overflow-hidden rounded-[10px] border border-line"><FileTree rootPath={sub.path} ide={own} /></div>}
      </div>
    </Card>
  )
}

/** v3.5: a group's projects side by side on its page, each with its scripts, workshop, .env and files */
export default function GroupProjects({ group, ide, onSave }: { group: Project; ide: PreferredIde; onSave: (patch: { subIdes: Record<string, DefaultIDE> }) => void }) {
  const { t } = useI18n()
  const h = t.hub
  const { runScript } = useConsole()
  const subs = group.subprojects ?? []
  const [scripts, setScripts] = useState<Record<string, Record<string, string>>>({})
  const paths = subs.map(s => s.path).join('|')
  useEffect(() => {
    Promise.all(paths.split('|').filter(Boolean).map(p => window.devforge.getProjectScripts(p).then(r => [p, r] as const).catch(() => [p, {}] as const)))
      .then(entries => setScripts(Object.fromEntries(entries)))
  }, [paths])

  const startable = subs.filter(s => devScript(scripts[s.path] ?? {}))
  async function runAll() {
    for (const s of startable) await runScript(s.path, devScript(scripts[s.path])!, s.packageManager, `${group.name}/${s.name}`)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-md font-semibold text-fg">{h.groupTitle.replace('{n}', String(subs.length))}</h2>
        {startable.length > 1 && <Button size="sm" onClick={runAll}><Play size={13} /> {h.groupRunAll}</Button>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
        {subs.map(sub => (
          <SubPanel key={sub.path} group={group} sub={sub} scripts={scripts[sub.path] ?? {}} ide={ide}
            onIde={next => {
              const { [sub.name]: _old, ...rest } = group.subIdes ?? {}
              onSave({ subIdes: next ? { ...rest, [sub.name]: next } : rest })
            }} />
        ))}
      </div>
    </section>
  )
}
