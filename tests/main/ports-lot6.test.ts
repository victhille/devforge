import { describe, expect, it } from 'vitest'
import { hostOf, parseNetstat, parseSs } from '../../src/main/services/system/portService'
import { reachableFromNetwork } from '../../src/shared/lib/netAddress'
import { projectOfCommand } from '../../src/main/services/suggest/portOwner'

/** Lot 6: the address a port listens on, and the project it comes from */
describe('listening ports', () => {
  it('reads the address of IPv4, IPv6 and Linux interface forms', () => {
    expect(hostOf('0.0.0.0:3000')).toBe('0.0.0.0')
    expect(hostOf('127.0.0.1:5432')).toBe('127.0.0.1')
    expect(hostOf('[::]:3000')).toBe('::')
    expect(hostOf('[::1]:5173')).toBe('::1')
    expect(hostOf('127.0.0.53%lo:53')).toBe('127.0.0.53')
    expect(hostOf('*:80')).toBe('0.0.0.0')
    expect(reachableFromNetwork('0.0.0.0')).toBe(true)
    expect(reachableFromNetwork('::')).toBe(true)
    expect(reachableFromNetwork('192.168.1.20')).toBe(true)
    expect(reachableFromNetwork('127.0.0.1')).toBe(false)
    expect(reachableFromNetwork('127.0.0.53')).toBe(false)
    expect(reachableFromNetwork('::1')).toBe(false)
    expect(reachableFromNetwork(undefined)).toBe(false)
  })

  it('netstat: one entry per port and process, the network address kept over the loopback one', () => {
    const out = [
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       4120',
      '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4120',
      '  TCP    [::1]:5173             [::]:0                 LISTENING       880',
      '  TCP    127.0.0.1:8000         0.0.0.0:0              LISTENING       700',
      '  TCP    [::]:8000              [::]:0                 LISTENING       701',
      '  TCP    192.168.1.20:52000     203.0.113.10:443       ESTABLISHED     990',
      '  UDP    0.0.0.0:5353           *:*                                    1200'
    ].join('\n')
    const names = new Map([[4120, 'node'], [880, 'node'], [700, 'php'], [701, 'caddy']])
    expect(parseNetstat(out, names)).toEqual([
      { port: 3000, pid: 4120, processName: 'node', address: '0.0.0.0' },
      { port: 5173, pid: 880, processName: 'node', address: '::1' },
      // Two processes on one port: each keeps its own address
      { port: 8000, pid: 700, processName: 'php', address: '127.0.0.1' },
      { port: 8000, pid: 701, processName: 'caddy', address: '::' }
    ])
  })

  it('ss: address, pid and process name', () => {
    const out = [
      'State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process',
      'LISTEN 0      511    127.0.0.1:5432     0.0.0.0:*        users:(("postgres",pid=301,fd=6))',
      'LISTEN 0      4096   *:8080             *:*'
    ].join('\n')
    expect(parseSs(out)).toEqual([
      { port: 5432, pid: 301, processName: 'postgres', address: '127.0.0.1' },
      { port: 8080, pid: null, processName: '', address: '0.0.0.0' }
    ])
  })
})

describe('project of a dev server', () => {
  const projects = [
    { id: 'a', path: 'C:\\Dev\\shop' },
    { id: 'b', path: 'C:\\Dev\\shop\\admin' },
    { id: 'c', path: 'C:\\Dev\\shopping\\' }
  ]

  it('matches the folder in the command line, the deepest project first', () => {
    expect(projectOfCommand('"c:\\program files\\nodejs\\node.exe" c:\\dev\\shop\\node_modules\\vite\\bin\\vite.js', projects)?.id).toBe('a')
    expect(projectOfCommand('node C:/Dev/shop/admin/server.js', projects)?.id).toBe('b')
    expect(projectOfCommand('php c:\\dev\\shopping\\artisan serve', projects)?.id).toBe('c')
  })

  it('a project at the root of a drive is nobody\'s', () => {
    const roots = [{ id: 'r', path: 'D:\\' }, { id: 's', path: '/' }, ...projects]
    expect(projectOfCommand('node d:\\tools\\server.js', roots)).toBeUndefined()
    expect(projectOfCommand('node /usr/lib/node_modules/x.js', roots)).toBeUndefined()
    expect(projectOfCommand('node C:/Dev/shop/admin/server.js', roots)?.id).toBe('b')
  })

  it('finds nothing for a process outside every project', () => {
    expect(projectOfCommand('C:\\Windows\\System32\\svchost.exe -k netsvcs', projects)).toBeUndefined()
    expect(projectOfCommand('node C:\\Dev\\shopify\\index.js', projects)).toBeUndefined()
  })
})
