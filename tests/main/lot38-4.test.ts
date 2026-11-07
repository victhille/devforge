import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import type { DbDiagramLink, DbDiagramTable } from '@shared/types'
import { autoLayout, boxSize, diagramSvg, linkPath, tableKey, withNeighbours, bounds, HEADER, ROW } from '@shared/lib/schemaLayout'
import { closeAllDbs, dbDiagram, dbQuery } from '../../src/main/services/database/dbClient'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'
import { tempDir } from '../helpers'

/** v3.8 lot 4: the database schema */

const table = (name: string, cols: string[] = ['id']): DbDiagramTable =>
  ({ name, schema: '', type: 'table', columns: cols.map((c, i) => ({ name: c, type: 'int', nullable: i > 0, pk: i === 0 })) })
const link = (from: string, col: string, to: string): DbDiagramLink => ({ from: { name: from, schema: '' }, columns: [col], to: { name: to, schema: '' }, refColumns: ['id'] })

// A shop: order → user, order_item → order and product, product → category; coupon alone
const TABLES = [table('user', ['id', 'email']), table('order', ['id', 'user_id']), table('order_item', ['id', 'order_id', 'product_id']), table('product', ['id', 'category_id']), table('category'), table('coupon')]
const LINKS = [link('order', 'user_id', 'user'), link('order_item', 'order_id', 'order'), link('order_item', 'product_id', 'product'), link('product', 'category_id', 'category')]

describe('layout', () => {
  const pos = autoLayout(TABLES, LINKS)
  const at = (name: string) => pos[`.${name}`]

  it('places every table, the ones pointed at to the left of those that point at them', () => {
    expect(Object.keys(pos).sort()).toEqual(TABLES.map(tableKey).sort())
    expect(at('user').x).toBeLessThan(at('order').x)
    expect(at('order').x).toBeLessThan(at('order_item').x)
    expect(at('category').x).toBeLessThan(at('product').x)
    expect(at('product').x).toBeLessThan(at('order_item').x)
    // The lone table goes below the linked ones
    expect(at('coupon').y).toBeGreaterThan(Math.max(...['user', 'order', 'order_item', 'product', 'category'].map(n => at(n).y)))
  })

  it('never overlaps two cards', () => {
    const boxes = TABLES.map(t => ({ ...pos[tableKey(t)], ...boxSize(t) }))
    for (const a of boxes) for (const b of boxes) {
      if (a === b) continue
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
      expect(apart).toBe(true)
    }
  })

  it('orders a column by its neighbours, so links do not cross', () => {
    // user's child (order) and category's child (product) keep the order of their parents
    const userFirst = at('user').y < at('category').y
    expect(at('order').y < at('product').y).toBe(userFirst)
  })

  it('survives cycles and self links', () => {
    const p = autoLayout([table('a', ['id', 'b_id']), table('b', ['id', 'a_id', 'parent_id'])], [link('a', 'b_id', 'b'), link('b', 'a_id', 'a'), link('b', 'parent_id', 'b')])
    expect(Object.keys(p)).toHaveLength(2)
  })

  it('adds the tables linked to those picked', () => {
    expect([...withNeighbours(['.order'], LINKS)].sort()).toEqual(['.order', '.order_item', '.user'])
  })

  it('sizes a card by its columns', () => {
    const s = boxSize(TABLES[2])
    expect(s.h).toBe(HEADER + 3 * ROW + 8)
    expect(s.w).toBeGreaterThanOrEqual(190)
  })
})

describe('links', () => {
  it('leave the pointing column and enter the column pointed at, by the facing sides', () => {
    const order = { x: 300, y: 0, w: 200, h: 100 }, user = { x: 0, y: 200, w: 200, h: 100 }
    const p = linkPath(order, TABLES[1], user, TABLES[0], LINKS[0])
    // From order's left side, at the row of user_id; into user's right side, at the row of id
    expect(p.d.startsWith(`M 300 ${HEADER + ROW + ROW / 2}`)).toBe(true)
    expect(p.end).toEqual({ x: 200, y: 200 + HEADER + ROW / 2 })
  })

  it('exports a standalone SVG with every table and arrow', () => {
    const pos = autoLayout(TABLES, LINKS)
    const svg = diagramSvg(TABLES, pos, LINKS, { canvas: '#000', card: '#111', header: '#222', line: '#333', text: '#eee', muted: '#999', key: '#fc0', link: '#58f' })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    for (const t of TABLES) expect(svg).toContain(`>${t.name}</text>`)
    expect(svg.match(/stroke="#58f"/g)).toHaveLength(LINKS.length)
    expect(bounds([]).w).toBe(0)
  })
})

describe('SQLite schema', () => {
  afterAll(() => closeAllDbs())

  it('reads every table, its columns, primary key and foreign keys at once', async () => {
    const file = join(tempDir('schema'), 'shop.sqlite')
    writeFileSync(file, Buffer.alloc(0))
    saveDbConnection({ id: 'schema', name: 'schema', type: 'sqlite', file, color: '' })
    for (const sql of [
      'CREATE TABLE user (id INTEGER PRIMARY KEY, email TEXT NOT NULL)',
      'CREATE TABLE "order" (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES user, note TEXT)',
      'CREATE TABLE item (order_id INTEGER, line INTEGER, PRIMARY KEY (order_id, line), FOREIGN KEY (order_id) REFERENCES "order"(id))',
      'CREATE VIEW recent AS SELECT * FROM "order"'
    ]) expect((await dbQuery('schema', sql)).error).toBeUndefined()
    const d = await dbDiagram('schema')
    expect(d.tables.map(t => [t.name, t.type])).toEqual([['item', 'table'], ['order', 'table'], ['recent', 'view'], ['user', 'table']])
    expect(d.tables.find(t => t.name === 'user')!.columns).toEqual([{ name: 'id', type: 'INTEGER', nullable: false, pk: true }, { name: 'email', type: 'TEXT', nullable: false, pk: false }])
    expect(d.tables.find(t => t.name === 'item')!.columns.filter(c => c.pk).map(c => c.name)).toEqual(['order_id', 'line'])
    // "REFERENCES user" with no column: its primary key
    expect(d.links).toEqual([
      { from: { schema: '', name: 'item' }, columns: ['order_id'], to: { schema: '', name: 'order' }, refColumns: ['id'] },
      { from: { schema: '', name: 'order' }, columns: ['user_id'], to: { schema: '', name: 'user' }, refColumns: ['id'] }
    ])
  })
})
