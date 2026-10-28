import type { Framework, UserTemplate } from '@shared/types'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => onTemplate(tpl)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-line-subtle bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-elevated hover:shadow-pop">
                <ProjectIcon framework={tpl.framework} />
                <span className="font-semibold text-fg">{tpl.name}</span>
                <span className="text-sm leading-snug text-fg-secondary">{tpl.description || t.templates.files.replace('{n}', String(tpl.files))}</span>
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => onSelect(tpl.id)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-line-subtle bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-elevated hover:shadow-pop"
                >
                  <div
                    className="flex size-10 items-center justify-center rounded-lg"
                    style={{ background: `${tpl.color}18` }}
                  >
                    <FrameworkIcon name={tpl.iconName} size={22} style={{ color: tpl.color }} />
                  </div>
                  <span className="font-semibold text-fg">{tpl.name}</span>
                  <span className="text-sm leading-snug text-fg-secondary">{t.newProject.templateDesc[tpl.id] ?? tpl.description}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </Page>
  )
}
