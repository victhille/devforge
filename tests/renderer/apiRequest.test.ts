import { describe, expect, it } from 'vitest'
import { headersToSend, pathOf, queryRows, withQuery } from '../../src/renderer/src/features/tools/api-tester/request'

describe('API tester request', () => {
  it('reads the query as rows, and writes rows back into the URL', () => {
    const url = 'http://localhost:3000/api/produits?limite=2&tri=prix%20bas&vide#haut'
    expect(queryRows(url)).toEqual([
      { key: 'limite', value: '2', on: true },
      { key: 'tri', value: 'prix bas', on: true },
      { key: 'vide', value: '', on: true }
    ])
    expect(withQuery(url, [{ key: 'limite', value: '5', on: true }, { key: '', value: 'x', on: true }])).toBe('http://localhost:3000/api/produits?limite=5#haut')
    expect(withQuery('http://x/a?b=1', [])).toBe('http://x/a')
    expect(queryRows('http://x/a')).toEqual([])
    expect(queryRows('http://x/a?%E0%A4%A=1')[0].key).toBe('%E0%A4%A')
  })

  it('sends the headers ticked, and the auth unless one is already there', () => {
    const rows = [{ key: 'Accept', value: 'application/json', on: true }, { key: 'X-Off', value: '1', on: false }, { key: '  ', value: 'x', on: true }]
    expect(headersToSend(rows, { kind: 'bearer', token: ' abc ', user: '', password: '' })).toEqual({ Accept: 'application/json', Authorization: 'Bearer abc' })
    expect(headersToSend(rows, { kind: 'basic', token: '', user: 'ada', password: 'pässe' }).Authorization).toBe(`Basic ${Buffer.from('ada:pässe').toString('base64')}`)
    expect(headersToSend([{ key: 'authorization', value: 'Token mine', on: true }], { kind: 'bearer', token: 'abc', user: '', password: '' }))
      .toEqual({ authorization: 'Token mine' })
    expect(headersToSend([], { kind: 'none', token: 'abc', user: '', password: '' })).toEqual({})
  })

  it('shows a path in the history', () => {
    expect(pathOf('https://api.example.com/v1/items?x=1')).toBe('/v1/items?x=1')
    expect(pathOf('http://localhost:3000')).toBe('/')
    expect(pathOf('/relative')).toBe('/relative')
  })
})
