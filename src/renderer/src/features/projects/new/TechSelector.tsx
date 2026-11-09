import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Framework, UserTemplate } from '@shared/types'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { PROJECT_TREES, drawTree } from '@shared/data/projectTrees'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import Button from '@renderer/components/ui/Button'
import Tabs from '@renderer/components/ui/Tabs'
import { paleClass } from '@renderer/lib/brand'
import ProjectIcon from '../components/ProjectIcon'
import WizardFrame, { FamilyLabel, type WizardStep } from './WizardFrame'

const CATEGORIES = ['frontend', 'fullstack', 'backend', 'other'] as const

/** A tile of the choice, as in the mock-up: picked, its border and background in the accent, and a tick */
function Tile({ on, onPick, onOpen, icon, name, desc }: { on: boolean; onPick: () => void; onOpen: () => void; icon: React.ReactNode; name: string; desc: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick} onDoubleClick={onOpen}
      className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        on ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-surface hover:border-fg-muted')}>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-semibold text-fg" title={name}>{name}</span>
        <span className="text-xs leading-snug text-fg-muted">{desc}</span>
      </span>
      {on && <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"><Check size={12} strokeWidth={3} /></span>}
    </button>
  )
}

/**
 * Step 1, as in the mock-up: a technology (or one of the user's templates) is
 * picked, not opened; the card on the right says what will be made, and Continue
 * goes on (a double click too).
 */
export default function TechSelector({ steps, templates, framework, template, onPick, onTemplate, onContinue }: {
  steps: WizardStep[]
  templates: UserTemplate[]
  framework: Framework | null
  template: UserTemplate | null
  onPick: (fw: Framework) => void
  onTemplate: (t: UserTemplate) => void
  onContinue: () => void
}) {
  const { t } = useI18n()
  const n = t.newProject
  const [mine, setMine] = useState(!!template)
  const labels = { frontend: n.catFrontend, fullstack: n.catFullstack, backend: n.catBackend, other: n.catOther }
  const tree = !template && framework ? PROJECT_TREES[framework] : undefined
  const picked = template ? template.name : framework ? n.templateName[framework] ?? PROJECT_TEMPLATES.find(x => x.id === framework)?.name ?? framework : null

  // Technologies or the user's templates: two lists, one at a time
  const seg = templates.length > 0 && (
    <Tabs<'tech' | 'mine'> label={n.techOrTemplate} value={mine ? 'mine' : 'tech'} onChange={v => setMine(v === 'mine')}
      items={[
        { value: 'tech', label: n.technologies },
        { value: 'mine', label: <>{t.templates.mine}<span className="font-mono text-2xs text-fg-muted">{templates.length}</span></> }
      ]} />
  )

  return (
    <WizardFrame steps={steps} subtitle={n.subtitle} headerRight={seg || undefined}
      asideTitle={n.willMake}
      aside={
        tree ? (
          <>
            <pre className="overflow-x-auto font-mono text-sm leading-[1.8] text-fg-secondary">{drawTree(n.treeRoot, tree.entries)}</pre>
            <p className="text-xs text-fg-muted">{tree.tool}</p>
          </>
        ) : template ? (
          <p className="text-sm text-fg-secondary">{n.willCopy.replace('{name}', template.name)}</p>
        ) : <p className="text-sm text-fg-muted">{n.pickFirst}</p>
      }
      footer={<Button disabled={!picked} onClick={onContinue}>{n.continue}</Button>}>
      {mine && templates.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
          {templates.map(tpl => (
            <Tile key={tpl.id} on={template?.id === tpl.id} onPick={() => onTemplate(tpl)} onOpen={() => { onTemplate(tpl); onContinue() }}
              icon={<ProjectIcon framework={tpl.framework} />} name={tpl.name} desc={tpl.description || t.templates.files.replace('{n}', String(tpl.files))} />
          ))}
        </div>
      ) : CATEGORIES.map(cat => {
        const list = PROJECT_TEMPLATES.filter(tpl => tpl.category === cat)
        if (!list.length) return null
        return (
          <section key={cat} className="flex flex-col gap-3" aria-label={labels[cat]}>
            <FamilyLabel>{labels[cat]}</FamilyLabel>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
              {list.map(tpl => (
                <Tile key={tpl.id} on={!template && framework === tpl.id} onPick={() => onPick(tpl.id)} onOpen={() => { onPick(tpl.id); onContinue() }}
                  icon={<span className="flex size-9 shrink-0 items-center justify-center rounded-control" style={{ background: `${tpl.color}18` }}>
                    <FrameworkIcon name={tpl.iconName} size={18} className={paleClass(tpl.color)} style={{ color: tpl.color }} />
                  </span>}
                  name={n.templateName[tpl.id] ?? tpl.name} desc={n.templateDesc[tpl.id] ?? tpl.description} />
              ))}
            </div>
          </section>
        )
      })}
    </WizardFrame>
  )
}
