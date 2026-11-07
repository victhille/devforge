import { describe, expect, it } from 'vitest'
import { checkMcd } from '@shared/lib/mcd'
import { toMld } from '@shared/lib/mpd'
import { mcdFromSpec, McdSpecError } from '@shared/lib/mcdSpec'

/** v4.1: an MCD from a description, as Forgy writes it */

const SHOP = {
  entities: [
    { name: 'CLIENT', attributes: [{ name: 'email', type: 'varchar', length: 180 }, { name: 'nom', type: 'string' }] },
    { name: 'COMMANDE', attributes: [{ name: 'numero', type: 'int', identifier: true }, { name: 'passee_le', type: 'datetime' }] },
    { name: 'PRODUIT', attributes: [{ name: 'libelle', type: 'varchar' }, { name: 'prix', type: 'money' }] }
  ],
  associations: [
    { name: 'PASSER', legs: [{ entity: 'client', card: '0,n' }, { entity: 'COMMANDE', card: '1,1' }] },
    { name: 'CONTENIR', legs: [{ entity: 'COMMANDE', card: '1..n' }, { entity: 'PRODUIT', card: '0..*' }], attributes: [{ name: 'quantite', type: 'integer' }] }
  ]
}

describe('mcdFromSpec', () => {
  const mcd = mcdFromSpec(SHOP)

  it('makes a valid MCD: an identifier for each entity, types and cardinalities in Merise terms', () => {
    expect(checkMcd(mcd).filter(i => i.level === 'error')).toEqual([])
    const client = mcd.entities.find(e => e.name === 'CLIENT')!
    expect(client.attributes[0]).toMatchObject({ name: 'id_client', type: 'int', identifier: true })
    expect(client.attributes.find(a => a.name === 'email')).toMatchObject({ type: 'varchar', length: 180 })
    expect(client.attributes.find(a => a.name === 'nom')).toMatchObject({ type: 'varchar', length: 255 })
    // The identifier given is kept, none is added
    expect(mcd.entities.find(e => e.name === 'COMMANDE')!.attributes.filter(a => a.identifier).map(a => a.name)).toEqual(['numero'])
    expect(mcd.entities.find(e => e.name === 'PRODUIT')!.attributes.find(a => a.name === 'prix')!.type).toBe('decimal')
    expect(mcd.links.map(l => l.card)).toEqual(['0,n', '1,1', '1,n', '0,n'])
    expect(mcd.associations.find(a => a.name === 'CONTENIR')!.attributes).toMatchObject([{ name: 'quantite', type: 'int' }])
  })

  it('gives the MLD the Merise rules expect', () => {
    const rel = Object.fromEntries(toMld(mcd).relations.map(r => [r.name.toLowerCase(), r.columns.map(c => c.name)]))
    // 1,1 side takes the foreign key; the n-n association becomes a table
    expect(Object.keys(rel).sort()).toEqual(['client', 'commande', 'contenir', 'produit'])
    expect(rel.commande).toContain('id_client')
    expect(rel.contenir).toEqual(expect.arrayContaining(['numero', 'id_produit', 'quantite']))
  })

  it('lays the boxes out apart, each association between its entities', () => {
    const spots = new Set(mcd.entities.map(e => `${e.x},${e.y}`))
    expect(spots.size).toBe(3)
    const passer = mcd.associations.find(a => a.name === 'PASSER')!
    const [c, o] = ['CLIENT', 'COMMANDE'].map(n => mcd.entities.find(e => e.name === n)!)
    expect(passer.x).toBeGreaterThanOrEqual(Math.min(c.x, o.x))
    expect(passer.x).toBeLessThanOrEqual(Math.max(c.x, o.x) + 120)
  })

  it('refuses what the model must fix, saying what', () => {
    const bad: [unknown, RegExp][] = [
      [{}, /at least one entity/],
      [{ entities: [{ name: '' }] }, /no name/],
      [{ entities: [{ name: 'A' }, { name: 'a' }] }, /unique/],
      [{ entities: [{ name: 'A', attributes: [{ name: 'x', type: 'blob' }] }] }, /Unknown type "blob"/],
      [{ entities: [{ name: 'A' }], associations: [{ name: 'LIER', legs: [{ entity: 'A', card: '1,1' }] }] }, /two legs/],
      [{ entities: [{ name: 'A' }], associations: [{ name: 'LIER', legs: [{ entity: 'A', card: '1,1' }, { entity: 'B', card: '0,n' }] }] }, /unknown entity "B"/],
      [{ entities: [{ name: 'A' }, { name: 'B' }], associations: [{ name: 'LIER', legs: [{ entity: 'A', card: '2,n' }, { entity: 'B', card: '0,n' }] }] }, /cardinality "2,n"/],
      [{ entities: Array.from({ length: 61 }, (_, i) => ({ name: `E${i}` })) }, /At most 60/]
    ]
    for (const [spec, msg] of bad) expect(() => mcdFromSpec(spec), JSON.stringify(spec).slice(0, 80)).toThrow(msg)
    expect(() => mcdFromSpec({})).toThrow(McdSpecError)
  })
})
