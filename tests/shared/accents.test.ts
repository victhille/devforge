import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { ACCENT_COLORS, PALETTES, PALETTE_VARS, TEXT_SCALE, TEXT_SIZES, type Palette } from '../../src/shared/lib/accents'

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mix = (fg: number[], bg: number[], alpha: number) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))

/** The backgrounds text sits on, and the texts that must be read (the disabled one is exempt) */
const BACKGROUNDS: (keyof Palette)[] = ['base', 'surface', 'elevated', 'hover', 'active', 'sidebar', 'console']
const TEXTS: (keyof Palette)[] = ['fg', 'fgSecondary', 'fgMuted', 'accent']

describe('colour palettes', () => {
  it('read at 4.5:1 at least: every text on every background, the accent on its own tint, the text on the accent', () => {
    const low: string[] = []
    const check = (what: string, value: number) => { if (value < 4.5) low.push(`${what} : ${value.toFixed(2)}`) }
    for (const id of ACCENT_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const p = PALETTES[id][theme]
        for (const text of TEXTS) for (const bg of BACKGROUNDS) check(`${id} ${theme} ${text} sur ${bg}`, ratio(rgb(p[text]), rgb(p[bg])))
        check(`${id} ${theme} sur sa teinte`, ratio(rgb(p.accent), mix(rgb(p.accent), rgb(p.surface), theme === 'dark' ? 0.14 : 0.1)))
        check(`${id} ${theme} texte sur la couleur`, ratio(rgb(p.accentFg), rgb(p.accent)))
        check(`${id} ${theme} texte au survol`, ratio(rgb(p.accentFg), rgb(p.accentHover)))
      }
    }
    expect(low).toEqual([])
  })

  it("keep Forge as the stylesheet has it, and write every theme variable", () => {
    const css = readFileSync('src/renderer/src/styles/index.css', 'utf8')
    for (const theme of ['dark', 'light'] as const) {
      for (const value of Object.values(PALETTES.forge[theme])) expect(css).toContain(value)
    }
    for (const name of Object.values(PALETTE_VARS)) expect(css).toContain(`${name}:`)
  })

  it('grow the text from the smallest size to the largest, normal at 1', () => {
    const scales = TEXT_SIZES.map(s => TEXT_SCALE[s])
    expect(scales).toEqual([...scales].sort((a, b) => a - b))
    expect(TEXT_SCALE.normal).toBe(1)
  })
})
