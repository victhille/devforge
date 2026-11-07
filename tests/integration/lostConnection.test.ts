import net from 'net'
import { afterAll, describe, expect, it } from 'vitest'
import { closeAllDbs, dbQuery } from '../../src/main/services/database/dbClient'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'

/**
 * Tiny fake PostgreSQL server: trusts every login, answers any query with one
 * row, and can kill sessions like `docker compose stop` does (57P01).
 */
function fakePostgres() {
  const msg = (type: string, body: Buffer) => {
    const h = Buffer.alloc(5)
    h.write(type, 0)
    h.writeInt32BE(body.length + 4, 1)
    return Buffer.concat([h, body])
  }
  const sockets: net.Socket[] = []
  const server = net.createServer(sock => {
    sockets.push(sock)
    let started = false
    sock.on('error', () => {})
    sock.on('data', () => {
      if (!started) {
        started = true
        const param = (k: string, v: string) => msg('S', Buffer.from(`${k}\0${v}\0`))
        sock.write(Buffer.concat([msg('R', Buffer.alloc(4)), param('server_version', '17.0'), param('client_encoding', 'UTF8'), msg('Z', Buffer.from('I'))]))
        return
      }
      const desc = Buffer.concat([Buffer.from([0, 1]), Buffer.from('v\0'), Buffer.alloc(18)])
      const row = Buffer.concat([Buffer.from([0, 1, 0, 0, 0, 2]), Buffer.from('17')])
      sock.write(Buffer.concat([msg('T', desc), msg('D', row), msg('C', Buffer.from('SELECT 1\0')), msg('Z', Buffer.from('I'))]))
    })
  })
  return {
    sockets,
    listen: () => new Promise<number>(r => server.listen(0, '127.0.0.1', () => r((server.address() as net.AddressInfo).port))),
    killSessions: () => {
      const err = Buffer.from('SFATAL\0C57P01\0Mterminating connection due to administrator command\0\0')
      for (const s of sockets) { s.write(msg('E', err)); s.end() }
    },
    close: () => server.close()
  }
}

describe('database server going away', () => {
  const pg = fakePostgres()
  afterAll(async () => { await closeAllDbs(); pg.close() })

  it('does not crash the process and reconnects on the next query', async () => {
    const crashes: Error[] = []
    const onCrash = (e: Error) => crashes.push(e)
    process.on('uncaughtException', onCrash)
    try {
      const port = await pg.listen()
      saveDbConnection({ id: 'pg', name: 'pg', type: 'postgres', host: '127.0.0.1', port, user: 'u', password: 'p', database: 'd', color: '' })
      expect((await dbQuery('pg', 'select 1')).error).toBeUndefined()

      pg.killSessions()
      await new Promise(r => setTimeout(r, 300))
      expect(crashes).toEqual([])

      expect((await dbQuery('pg', 'select 1')).error).toBeUndefined()
      expect(pg.sockets).toHaveLength(2)
    } finally {
      process.off('uncaughtException', onCrash)
    }
  })
})
