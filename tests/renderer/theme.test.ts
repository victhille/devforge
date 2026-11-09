import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { XTERM_THEME } from '@renderer/features/terminal/snapshot'

/** xterm cannot read CSS variables, so its palette repeats the theme's terminal colors */
describe('terminal colors', () => {
  const css = readFileSync(join(__dirname, '../../src/renderer/src/styles/index.css'), 'utf-8')
  const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]?.toUpperCase()

  it('the terminal in blocks and xterm share their background and text', () => {
    expect(XTERM_THEME.background.toUpperCase()).toBe(token('term'))
    expect(XTERM_THEME.foreground.toUpperCase()).toBe(token('term-fg'))
  })
})
