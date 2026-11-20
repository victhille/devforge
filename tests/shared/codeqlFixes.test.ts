import { describe, expect, it } from 'vitest'
import { isPackageName } from '../../src/shared/lib/packages'
import { notesToText } from '../../src/shared/lib/notesFormat'

/** What CodeQL caught: a Composer name read in linear time, and no tag left in the notes' text */
describe('CodeQL fixes', () => {
  it('reads Composer names as before, and a crafted one in linear time', () => {
    expect(isPackageName('laravel/framework', true)).toBe(true)
    expect(isPackageName('vendor-x/package.name--extra', true)).toBe(true)
    expect(isPackageName('Vendor/Package', true)).toBe(false)
    expect(isPackageName('vendor//package', true)).toBe(false)
    const t = Date.now()
    expect(isPackageName('0/' + '0'.repeat(200) + '!', true)).toBe(false)
    expect(Date.now() - t).toBeLessThan(1000)
  })

  it('leaves no tag in the notes as text, even one split by another', () => {
    const text = notesToText('<p>avant <scr<b>ipt>alert(1)</scr</b>ipt> après</p>')
    expect(text).not.toMatch(/<\s*\/?\s*script/i)
    expect(text).toContain('avant')
  })
})
