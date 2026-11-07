import { describe, expect, it } from 'vitest'
import type { DbDiagram, McdModel, MpdModel } from '@shared/types'
import { checkMcd } from '@shared/lib/mcd'
import { freeSpot, overlaps, tidyMcd } from '@shared/lib/mcdTidy'
import { diffMpd, importDb } from '@shared/lib/mpdDb'

/** v4.1: the tidy MCD the editor proposes, and an import laid out the same way */

const attr = (id: string, name: string, identifier = false) => ({ id, name, type: 'int' as const, ...(identifier ? { identifier: true } : {}) })
/** An MCD as imports made it before: names twice, every box at the same spots, keys unlinked */
const messy = (): McdModel => ({
  entities: [
    { id: 'u', name: 'USER', x: 300, y: 300, attributes: [attr('u1', 'id_user', true), attr('u2', 'firstname')] },
    { id: 'r', name: 'ACCESS_REQUEST', x: 600, y: 100, attributes: [attr('r1', 'id_access_request', true)] },
    { id: 'c', name: 'USER_CONTACT', x: 600, y: 600, attributes: [attr('c1', 'user_id', true), attr('c2', 'email')] },
    { id: 'd', name: 'DOCTRINE_MIGRATION_VERSIONS', x: 0, y: 900, attributes: [attr('d1', 'version', true)] },
    { id: 'h', name: 'PUBLIC_HOLIDAY', x: 300, y: 900, attributes: [attr('h1', 'id_public_holiday', true)] }
  ],
  associations: [
    { id: 's1', name: 'ACCESS_REQUEST_USER', x: 300, y: 300, attributes: [] },
    { id: 's2', name: 'ACCESS_REQUEST_USER', x: 300, y: 300, attributes: [] },
    { id: 's3', name: 'USER_USER', x: 320, y: 320, attributes: [] }
  ],
  links: [
    { id: 'l1', entity: 'r', association: 's1', card: '1,1' }, { id: 'l2', entity: 'u', association: 's1', card: '0,n' },
    { id: 'l3', entity: 'r', association: 's2', card: '0,1' }, { id: 'l4', entity: 'u', association: 's2', card: '0,n' },
    { id: 'l5', entity: 'u', association: 's3', card: '0,1' }, { id: 'l6', entity: 'u', association: 's3', card: '0,n' }
  ],
  notes: []
})
/** The MPD made from it knows each foreign key's column */
const mpd = { engine: 'postgres', tables: [{ id: 't', name: 'access_request', x: 0, y: 0, columns: [
  { id: 'k1', name: 'requester_id', type: 'int', from: 'l2:u1' }, { id: 'k2', name: 'reviewer_id', type: 'int', from: 'l4:u1' }
] }, { id: 't2', name: 'user', x: 0, y: 0, columns: [{ id: 'k3', name: 'manager_id', type: 'int', from: 'l6:u1' }] }] } as unknown as MpdModel

describe('tidyMcd', () => {
  const before = messy()
  const { mcd, changes } = tidyMcd(before, mpd)

  it('says what it changes', () => {
    expect(changes).toEqual([
      { code: 'removed', name: 'DOCTRINE_MIGRATION_VERSIONS' },
      { code: 'linked', name: 'USER_CONTACT', to: 'USER', attribute: 'user_id' },
      { code: 'renamed', name: 'ACCESS_REQUEST_USER', to: 'ACCESS_REQUEST_REQUESTER' },
      { code: 'renamed', name: 'ACCESS_REQUEST_USER', to: 'ACCESS_REQUEST_REVIEWER' },
      { code: 'moved', count: expect.any(Number) }
    ])
  })

  it('leaves no name twice, nothing on top of anything, no framework table', () => {
    const issues = checkMcd(mcd)
    expect(issues.filter(i => i.code === 'sameName' || i.code === 'overlap')).toEqual([])
    expect(overlaps(mcd)).toEqual([])
    expect(mcd.entities.map(e => e.name)).not.toContain('DOCTRINE_MIGRATION_VERSIONS')
    // A table that really is alone stays, said alone
    expect(issues.filter(i => i.code === 'lonelyEntity').map(i => i.name)).toEqual(['PUBLIC_HOLIDAY'])
    // The self link has a single name: kept
    expect(mcd.associations.map(a => a.name).sort()).toEqual(['ACCESS_REQUEST_REQUESTER', 'ACCESS_REQUEST_REVIEWER', 'USER_CONTACT_USER', 'USER_USER'])
  })

  it('links the entity whose key is another one\'s, one on each side, with an identifier of its own', () => {
    const contact = mcd.entities.find(e => e.name === 'USER_CONTACT')!
    expect(contact.attributes.map(a => [a.name, !!a.identifier])).toEqual([['id_user_contact', true], ['email', false]])
    const a = mcd.associations.find(x => x.name === 'USER_CONTACT_USER')!
    expect(mcd.links.filter(l => l.association === a.id).map(l => [mcd.entities.find(e => e.id === l.entity)!.name, l.card])).toEqual([['USER_CONTACT', '1,1'], ['USER', '0,1']])
  })

  it('never changes the model it was given', () => {
    expect(before).toEqual(messy())
  })

  it('numbers duplicates when no MPD says their roles', () => {
    const { mcd: m } = tidyMcd(messy())
    expect(m.associations.map(a => a.name).sort()).toEqual(['ACCESS_REQUEST_USER', 'ACCESS_REQUEST_USER_2', 'USER_CONTACT_USER', 'USER_USER'])
  })

  it('has nothing to say of a tidy MCD', () => {
    expect(tidyMcd(mcd, mpd).changes).toEqual([])
  })
})

describe('freeSpot', () => {
  it('keeps the wanted spot when it is free, else the nearest one touching nothing', () => {
    const taken = [{ x: 0, y: 0, w: 150, h: 80 }, { x: 190, y: 0, w: 150, h: 80 }]
    expect(freeSpot(taken, { x: 170, y: 300 }, 116, 44)).toEqual({ x: 170, y: 300 })
    const p = freeSpot(taken, { x: 170, y: 40 }, 116, 44)
    const box = { x: p.x - 58, y: p.y - 22, w: 116, h: 44 }
    for (const b of taken) expect(box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h).toBe(false)
    expect(Math.hypot(p.x - 170, p.y - 40)).toBeLessThan(120)
  })
})

describe('import from a database (v4.1)', () => {
  const t = (name: string, columns: [string, boolean][]) => ({ name, schema: 'public', type: 'table' as const, columns: columns.map(([n, pk]) => ({ name: n, type: 'integer', nullable: !pk, pk })) })
  const fk = (from: string, col: string, to: string) => ({ from: { name: from, schema: 'public' }, columns: [col], to: { name: to, schema: 'public' }, refColumns: ['id'] })
  const db: DbDiagram = {
    tables: [
      t('user', [['id', true], ['manager_id', false]]),
      t('access_request', [['id', true], ['requester_id', false], ['reviewer_id', false]]),
      ...['clock_event', 'contract', 'leave_balance', 'work_schedule', 'attendance_record', 'approval', 'access_log', 'user_assignment'].map(n => t(n, [['id', true], ['user_id', false]])),
      t('doctrine_migration_versions', [['version', true]])
    ],
    links: [
      fk('user', 'manager_id', 'user'), fk('access_request', 'requester_id', 'user'), fk('access_request', 'reviewer_id', 'user'),
      ...['clock_event', 'contract', 'leave_balance', 'work_schedule', 'attendance_record', 'approval', 'access_log', 'user_assignment'].map(n => fk(n, 'user_id', 'user'))
    ]
  }
  const { mcd, mpd: made } = importDb(db, 'postgres', 'rh.mcd.json')

  it('names each association once, after the key\'s role, and lays everything out apart', () => {
    expect(mcd.associations.map(a => a.name)).toEqual(expect.arrayContaining(['USER_MANAGER', 'ACCESS_REQUEST_REQUESTER', 'ACCESS_REQUEST_REVIEWER', 'CONTRACT_USER']))
    expect(checkMcd(mcd).filter(i => i.level === 'error' || i.code === 'overlap')).toEqual([])
  })

  it('leaves the framework\'s table out, and never proposes to drop it', () => {
    expect(mcd.entities.map(e => e.name)).not.toContain('DOCTRINE_MIGRATION_VERSIONS')
    expect(diffMpd(made, db)).toEqual([])
  })
})
