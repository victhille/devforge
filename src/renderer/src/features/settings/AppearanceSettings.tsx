import { Check, Play } from 'lucide-react'
import type { AccentColor, AppLanguage, AppSettings, Density, MotionSetting, TextSize, Theme } from '@shared/types'
import { ACCENT_COLORS, PALETTES, TEXT_SIZES } from '@shared/lib/accents'
import { useI18n } from '@renderer/i18n/I18nContext'
import { shownTheme } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import { Segmented, SettingRow, SettingsCard } from './parts'

const THEMES: Theme[] = ['dark', 'light', 'system']

/** A theme's small preview, in the chosen colour's palette (Like Windows: half dark, half light) */
function previewOf(theme: Theme, accent: AccentColor) {
  const dark = PALETTES[accent].dark, light = PALETTES[accent].light
  const p = theme === 'light' ? light : dark
  return {
    bg: theme === 'system' ? `linear-gradient(90deg,${dark.base} 50%,${light.base} 50%)` : p.base,
    side: p.sidebar, card: theme === 'system' ? dark.border : p.surface, ink: theme === 'system' ? dark.fgSecondary : p.fg, line: p.border, accent: p.accent
  }
}

type Set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => Promise<void>

/** Settings › Appearance: the theme, then the display (language, main colour, text size, density, motion) beside a preview */
export default function AppearanceSettings({ settings, set }: { settings: AppSettings; set: Set }) {
  const { t } = useI18n()
  const s = t.settings
  const accent: AccentColor = settings.accent && PALETTES[settings.accent] ? settings.accent : 'forge'
  const theme = shownTheme(settings.theme)
  const density = settings.density ?? 'comfortable'

  return (
    <>
      <SettingsCard title={s.theme}>
        <div className="px-5 pt-1 pb-4.5">
          <div role="radiogroup" aria-label={s.theme} className="grid grid-cols-3 gap-3">
            {THEMES.map(id => {
              const on = settings.theme === id
              const th = { id, ...previewOf(id, accent) }
              return (
                <button key={th.id} type="button" role="radio" aria-checked={on} onClick={() => set('theme', th.id)}
                  className={cn('flex flex-col gap-2.5 rounded-xl border-2 bg-canvas p-2.5 text-left transition-[border-color,transform] hover:-translate-y-0.5', on ? 'border-accent' : 'border-line')}>
                  <div aria-hidden className="flex h-[86px] overflow-hidden rounded-lg" style={{ background: th.bg }}>
                    <div className="flex w-[26%] flex-col gap-[5px] px-1.5 py-2" style={{ background: th.side }}>
                      <span className="h-[5px] rounded-[3px]" style={{ background: th.line }} />
                      <span className="h-[5px] w-[70%] rounded-[3px]" style={{ background: th.line }} />
                      <span className="h-[5px] w-[80%] rounded-[3px]" style={{ background: th.accent }} />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                      <span className="h-[7px] w-1/2 rounded-[3px]" style={{ background: th.ink }} />
                      <span className="flex-1 rounded-md" style={{ background: th.card }} />
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-base font-medium text-fg">
                    <span className={cn('size-3.5 rounded-full', on ? 'border-[5px] border-accent' : 'border-[1.5px] border-fg-disabled')} />
                    {th.id === 'dark' ? s.themeDark : th.id === 'light' ? s.themeLight : s.themeAuto}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </SettingsCard>

      <div className="grid items-start gap-4.5 @min-[760px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SettingsCard title={s.groups.display}>
          <SettingRow label={s.language} hint={s.languageHint}>
            <Segmented<AppLanguage> label={s.language} value={settings.language} onChange={v => set('language', v)}
              items={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
          </SettingRow>
          <SettingRow label={s.accent} hint={s.accentHint} stacked>
            <div className="flex flex-wrap items-center gap-2.5">
              <div role="radiogroup" aria-label={s.accent} className="flex flex-wrap gap-1.5">
                {ACCENT_COLORS.map(id => {
                  const on = accent === id
                  const tone = PALETTES[id][theme]
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} aria-label={s.accents[id]} title={s.accents[id]} onClick={() => set('accent', id)}
                      className={cn('flex size-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110', on ? 'border-fg' : 'border-transparent')}>
                      <span className="flex size-6 items-center justify-center rounded-full" style={{ background: tone.accent, color: tone.accentFg }}>
                        {on && <Check size={13} strokeWidth={3} aria-hidden />}
                      </span>
                    </button>
                  )
                })}
              </div>
              <span className="text-sm text-fg-secondary">{s.accents[accent]}</span>
            </div>
          </SettingRow>
          <SettingRow label={s.textSize} hint={s.textSizeHint}>
            <Segmented<TextSize> label={s.textSize} value={settings.textSize ?? 'normal'} onChange={v => set('textSize', v)}
              items={TEXT_SIZES.map(v => ({ value: v, label: s.textSizes[v] }))} />
          </SettingRow>
          <SettingRow label={s.density} hint={s.densityHint}>
            <Segmented<Density> label={s.density} value={density} onChange={v => set('density', v)}
              items={[{ value: 'comfortable', label: s.densityComfortable }, { value: 'compact', label: s.densityCompact }]} />
          </SettingRow>
          <SettingRow label={s.motion} hint={s.motionHint}>
            <Segmented<MotionSetting> label={s.motion} value={settings.motion ?? 'system'} onChange={v => set('motion', v)}
              items={[{ value: 'full', label: s.motionFull }, { value: 'reduced', label: s.motionReduced }, { value: 'system', label: s.motionSystem }]} />
          </SettingRow>
        </SettingsCard>

        {/* What a project card looks like with these choices: made of the app's own pieces, nothing in it answers a click */}
        <SettingsCard title={s.preview} action={<Badge>{density === 'compact' ? s.densityCompact : s.densityComfortable}</Badge>}>
          <div aria-hidden className="border-t border-line-subtle px-5 py-4.5">
            <div className="pointer-events-none flex flex-col gap-3 rounded-card border border-line bg-canvas p-4">
              <div className="flex items-center gap-2.5">
                <span className="size-7 shrink-0 rounded-md border border-line bg-elevated" />
                <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg">{s.previewName}</span>
                <Badge color="success" dot>{s.previewRunning}</Badge>
              </div>
              <p className="text-sm text-fg-secondary">{s.previewMeta}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" tabIndex={-1}><Play size={13} /> {s.previewRun}</Button>
                <Button size="sm" variant="secondary" tabIndex={-1}>{s.previewOpen}</Button>
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>
    </>
  )
}
