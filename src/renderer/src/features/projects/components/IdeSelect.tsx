import type { DefaultIDE } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import type { PreferredIde } from '@renderer/lib/ide'

/** v3.5: the IDE one project opens in: the default one, or one found on this PC */
export default function IdeSelect({ ide, value, onChange, label, className }: {
  ide: PreferredIde
  value?: DefaultIDE
  onChange: (next: DefaultIDE | undefined) => void
  label: string
  className?: string
}) {
  const { t } = useI18n()
  const own = value && value !== ide.ide ? ide.pick(value) : ''
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <select value={own === ide.ide ? '' : own} onChange={e => onChange(e.target.value || undefined)} title={label}
        className={cn('h-8 max-w-[200px] rounded-lg border border-line bg-canvas px-2 text-xs text-fg-secondary outline-none focus:border-accent/60')}>
        <option value="">{t.hub.ideDefault.replace('{ide}', ide.label ?? t.settings.ideNone)}</option>
        {ide.list.filter(i => i.installed && i.id !== ide.ide).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </label>
  )
}
