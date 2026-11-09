import { describe, expect, it } from 'vitest'
import { codeLanguage, codeLanguageByName } from '@shared/lib/codeLanguage'

describe('code languages', () => {
  it('a language as people name it, case and spaces ignored', () => {
    expect(codeLanguageByName('TypeScript')).toBe('typescript')
    expect(codeLanguageByName(' bash ')).toBe('bash')
    expect(codeLanguageByName('Shell')).toBe('bash')
    expect(codeLanguageByName('HTML')).toBe('xml')
    expect(codeLanguageByName('Other')).toBeNull()
  })

  it('a file still known by its name', () => {
    expect(codeLanguage('Dockerfile.dev')).toBe('dockerfile')
    expect(codeLanguage('app.ts')).toBe('typescript')
  })
})
