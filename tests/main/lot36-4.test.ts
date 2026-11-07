import { describe, expect, it } from 'vitest'
import { decodeCsv, guessSeparator, matchColumns, parseCsv } from '../../src/shared/lib/csvImport'

/** v3.6 lot 4: a CSV read for import */
describe('v3.6 lot 4: CSV import', () => {
  it('guesses the separator from the header, quotes ignored', () => {
    expect(guessSeparator('id;name;"a;b"\n1;x;y')).toBe(';')
    expect(guessSeparator('id,name\n1,x')).toBe(',')
    expect(guessSeparator('id\tname\n')).toBe('\t')
    expect(guessSeparator('single\n1\n')).toBe(',')
  })

  it('reads quotes, doubled quotes, separators and line breaks inside them, CRLF and a BOM', () => {
    const text = '﻿id,name,note\r\n1,"Smith, John","said ""hi""\nthen left"\r\n2,Ada,\r\n\r\n'
    expect(parseCsv(text, ',')).toEqual([
      ['id', 'name', 'note'],
      ['1', 'Smith, John', 'said "hi"\nthen left'],
      ['2', 'Ada', '']
    ])
  })

  it('decodes UTF-8, or Windows-1252 as Excel writes it', () => {
    expect(decodeCsv(new TextEncoder().encode('nom;ville\nÉlodie;Nîmes'))).toEqual({ text: 'nom;ville\nÉlodie;Nîmes', encoding: 'utf-8' })
    // "Élodie" in Windows-1252: É is 0xC9, an invalid UTF-8 start here
    const latin = new Uint8Array([0x6e, 0x6f, 0x6d, 0x0a, 0xc9, 0x6c, 0x6f, 0x64, 0x69, 0x65])
    expect(decodeCsv(latin)).toEqual({ text: 'nom\nÉlodie', encoding: 'windows-1252' })
  })

  it('matches columns by name, case and separators aside, each table column once', () => {
    expect(matchColumns(['ID', 'First Name', 'e-mail', 'unknown', 'id'], ['id', 'first_name', 'email', 'created_at']))
      .toEqual(['id', 'first_name', 'email', null, null])
  })
})
