import type { AccentColor, TextSize } from '../types'

/** One colour in one theme: the accent (its hover, the text on it), then the backgrounds, borders and texts tinted by it */
export interface Palette {
  accent: string; accentHover: string; accentFg: string
  base: string; surface: string; elevated: string; hover: string; active: string; console: string; sidebar: string; chrome: string
  border: string; borderSubtle: string
  fg: string; fgSecondary: string; fgMuted: string; fgDisabled: string
}

/**
 * The colours of Settings › Appearance, each one a whole look in the dark and the light theme: Forge's warm graphite
 * turned to the colour's hue (same lightness in OKLCH, a little more chroma), the cards of the light theme kept white.
 * Every text reads at 4.5:1 at least on every background, and so does the accent (tests/shared/accents.test.ts).
 * 'forge' is what the stylesheet already has (index.css): nothing is written over it.
 */
export const PALETTES: Record<AccentColor, { dark: Palette; light: Palette }> = {
  forge: {
    dark: { accent: '#FF7A33', accentHover: '#FF9457', accentFg: '#1A0A02', base: '#121110', surface: '#1A1816', elevated: '#221F1C', hover: '#262320', active: '#2A2622', console: '#0E0D0C', sidebar: '#151311', chrome: '#0E0D0C', border: '#2E2A26', borderSubtle: '#25221F', fg: '#F2EEE9', fgSecondary: '#B5ADA4', fgMuted: '#9E968D', fgDisabled: '#4A443E' },
    light: { accent: '#B53C0B', accentHover: '#9A3412', accentFg: '#FFFFFF', base: '#F7F4F0', surface: '#FFFFFF', elevated: '#F3EFEA', hover: '#F0EBE5', active: '#ECE6DF', console: '#FBF9F6', sidebar: '#FBF9F6', chrome: '#FFFFFF', border: '#E4DED6', borderSubtle: '#EEE9E3', fg: '#1E1A16', fgSecondary: '#5C544C', fgMuted: '#6A6158', fgDisabled: '#ABA196' }
  },
  blue: {
    dark: { accent: '#6AA4FF', accentHover: '#8AB8FF', accentFg: '#03112B', base: '#0E1116', surface: '#131922', elevated: '#17202D', hover: '#1B2432', active: '#1C2739', console: '#0A0D12', sidebar: '#0E141D', chrome: '#0A0D12', border: '#202B3D', borderSubtle: '#1A2331', fg: '#E2F0FF', fgSecondary: '#A0B0C8', fgMuted: '#8999B1', fgDisabled: '#38465B' },
    light: { accent: '#1F5BC9', accentHover: '#1A4CA8', accentFg: '#FFFFFF', base: '#EBF5FF', surface: '#FFFFFF', elevated: '#E4F1FF', hover: '#DEEDFF', active: '#D8E8FF', console: '#F3FAFF', sidebar: '#F3FAFF', chrome: '#FFFFFF', border: '#D0E0FA', borderSubtle: '#DCEBFF', fg: '#101B2D', fgSecondary: '#49566C', fgMuted: '#56637A', fgDisabled: '#95A4BD' }
  },
  violet: {
    dark: { accent: '#B48CFF', accentHover: '#C6A6FF', accentFg: '#170A30', base: '#121015', surface: '#191621', elevated: '#211D2C', hover: '#252130', active: '#292337', console: '#0E0C11', sidebar: '#14111B', chrome: '#0E0C11', border: '#2D273B', borderSubtle: '#24202F', fg: '#F1EBFF', fgSecondary: '#B1A9C5', fgMuted: '#9A93AD', fgDisabled: '#484158' },
    light: { accent: '#6B3FC2', accentHover: '#5A33A6', accentFg: '#FFFFFF', base: '#F5F2FF', surface: '#FFFFFF', elevated: '#F0ECFF', hover: '#EDE8FF', active: '#E8E3FF', console: '#FAF7FF', sidebar: '#FAF7FF', chrome: '#FFFFFF', border: '#E0DBF8', borderSubtle: '#EBE6FF', fg: '#1C172B', fgSecondary: '#56526A', fgMuted: '#635F78', fgDisabled: '#A39FBA' }
  },
  pink: {
    dark: { accent: '#FF6FAA', accentHover: '#FF8FBE', accentFg: '#2B0516', base: '#150F11', surface: '#201518', elevated: '#2B1A20', hover: '#2F1E24', active: '#361F27', console: '#110B0D', sidebar: '#1B1013', chrome: '#110B0D', border: '#3A232B', borderSubtle: '#2E1D23', fg: '#FFE6EF', fgSecondary: '#C5A4AF', fgMuted: '#AD8E98', fgDisabled: '#573C45' },
    light: { accent: '#B3205C', accentHover: '#981A4E', accentFg: '#FFFFFF', base: '#FFEEF3', surface: '#FFFFFF', elevated: '#FFE7EE', hover: '#FFE2E9', active: '#FFDDE4', console: '#FFF5F8', sidebar: '#FFF5F8', chrome: '#FFFFFF', border: '#F7D5DC', borderSubtle: '#FFE0E7', fg: '#2A1219', fgSecondary: '#694C53', fgMuted: '#775961', fgDisabled: '#B999A0' }
  },
  teal: {
    dark: { accent: '#2EC4B6', accentHover: '#5AD3C7', accentFg: '#02201C', base: '#0C1312', surface: '#0D1B1A', elevated: '#0E2421', hover: '#122825', active: '#0D2D29', console: '#080F0E', sidebar: '#081615', chrome: '#080F0E', border: '#12312D', borderSubtle: '#112724', fg: '#D8F6F2', fgSecondary: '#93B7B2', fgMuted: '#7CA09B', fgDisabled: '#2B4C48' },
    light: { accent: '#0B7268', accentHover: '#095E56', accentFg: '#FFFFFF', base: '#E3FAF6', surface: '#FFFFFF', elevated: '#D9F7F2', hover: '#D0F5EF', active: '#CBF0EA', console: '#EDFEFB', sidebar: '#EDFEFB', chrome: '#FFFFFF', border: '#C3E8E2', borderSubtle: '#CEF3ED', fg: '#00211D', fgSecondary: '#3B5D58', fgMuted: '#496A65', fgDisabled: '#88ABA6' }
  },
  green: {
    dark: { accent: '#5CCB6E', accentHover: '#7CD88B', accentFg: '#04170A', base: '#0E130F', surface: '#121B13', elevated: '#162318', hover: '#1A271C', active: '#1A2C1C', console: '#0A0F0B', sidebar: '#0D160E', chrome: '#0A0F0B', border: '#1E3020', borderSubtle: '#19261B', fg: '#E2F5E3', fgSecondary: '#9FB6A0', fgMuted: '#889F89', fgDisabled: '#374B39' },
    light: { accent: '#25712D', accentHover: '#1F5F26', accentFg: '#FFFFFF', base: '#EBF9EB', surface: '#FFFFFF', elevated: '#E3F6E3', hover: '#DDF3DD', active: '#D7EFD7', console: '#F2FDF2', sidebar: '#F2FDF2', chrome: '#FFFFFF', border: '#CFE7CF', borderSubtle: '#DBF1DB', fg: '#0E200F', fgSecondary: '#485C48', fgMuted: '#556955', fgDisabled: '#94AA94' }
  }
}

export const ACCENT_COLORS = Object.keys(PALETTES) as AccentColor[]

/** Each colour of a palette and the theme variable it is written to (index.css) */
export const PALETTE_VARS: Record<keyof Palette, string> = {
  accent: '--accent', accentHover: '--accent-hover', accentFg: '--accent-fg',
  base: '--bg-base', surface: '--bg-surface', elevated: '--bg-elevated', hover: '--bg-hover', active: '--bg-active',
  console: '--bg-console', sidebar: '--bg-sidebar', chrome: '--bg-chrome',
  border: '--border', borderSubtle: '--border-subtle',
  fg: '--text-primary', fgSecondary: '--text-secondary', fgMuted: '--text-muted', fgDisabled: '--text-disabled'
}

/** The soft tint behind a selected item or a tag: the accent at 14 % on dark, 10 % on light */
export function accentSoft(hex: string, theme: 'dark' | 'light'): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${theme === 'dark' ? 0.14 : 0.1})`
}

/** How much the text grows or shrinks, from the smallest to the largest */
export const TEXT_SIZES: TextSize[] = ['small', 'normal', 'large', 'larger']
export const TEXT_SCALE: Record<TextSize, number> = { small: 0.92, normal: 1, large: 1.12, larger: 1.25 }
