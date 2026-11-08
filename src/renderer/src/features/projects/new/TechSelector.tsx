import type { Framework, UserTemplate } from '@shared/types'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import { paleClass } from '@renderer/lib/brand'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import ProjectIcon from '../components/ProjectIcon'

const CATEGORIES = ['frontend', 'fullstack', 'backend', 'other'] as const

/** Step 1: pick a technology. */
export default function TechSelector({ onSelect, templates, onTemplate }: { onSelect: (fw: Framework) => void; templates: UserTemplate[]; onTemplate: (t: UserTemplate) => void }) {
  const { t } = useI18n()
  const labels = {
    frontend:  t.newProject.catFrontend,
    fullstack: t.newProject.catFullstack,
    backend:   t.newProject.catBackend,
    other:     t.newProject.catOther
  }

  return (
    <Page>
      <PageHeader title={t.newProject.title} subtitle={t.newProject.subtitle} />

      {/* v3.8: the user's own templates first */}
      {templates.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label={t.templates.mine}>
          <SectionTitle>{t.templates.mine}</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => onTemplate(tpl)}
                className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface p-3 text-left transition-colors hover:border-fg-muted">
                <ProjectIcon framework={tpl.framework} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold text-fg" title={tpl.name}>{tpl.name}</span>
                  <span className="text-xs leading-snug text-fg-muted">{tpl.description || t.templates.files.replace('{n}', String(tpl.files))}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {CATEGORIES.map(cat => {
        const templates = PROJECT_TEMPLATES.filter(tpl => tpl.category === cat)
        if (templates.length === 0) return null
        return (
          <section key={cat} className="flex flex-col gap-2.5">
            <SectionTitle>{labels[cat]}</SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => onSelect(tpl.id)}
                  className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface p-3 text-left transition-colors hover:border-fg-muted"
                >
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${tpl.color}18` }}
                  >
                    <FrameworkIcon name={tpl.iconName} size={20} className={paleClass(tpl.color)} style={{ color: tpl.color }} />
                  </div>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-semibold text-fg" title={t.newProject.templateName[tpl.id] ?? tpl.name}>{t.newProject.templateName[tpl.id] ?? tpl.name}</span>
                    <span className="text-xs leading-snug text-fg-muted">{t.newProject.templateDesc[tpl.id] ?? tpl.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </Page>
  )
}
