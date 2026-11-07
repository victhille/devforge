import { describe, expect, it } from 'vitest'
import { quoteColumn, quoteIdent } from '@shared/lib/sqlQuote'

describe('SQL identifier quoting', () => {
  it('quotes per dialect', () => {
    expect(quoteIdent('mysql', { name: 'users', schema: '' })).toBe('`users`')
    expect(quoteIdent('postgres', { name: 'users', schema: 'public' })).toBe('"public"."users"')
    expect(quoteIdent('sqlite', { name: 'users', schema: '' })).toBe('"users"')
  })

  it('escapes the quote character so a name cannot break out', () => {
    expect(quoteIdent('mysql', { name: 'a`; DROP TABLE x; --', schema: '' })).toBe('`a``; DROP TABLE x; --`')
    expect(quoteIdent('postgres', { name: 'a"b', schema: 's"' })).toBe('"s"""."a""b"')
    expect(quoteColumn('mysql', 'we`ird')).toBe('`we``ird`')
    expect(quoteColumn('sqlite', 'we"ird')).toBe('"we""ird"')
  })
})
