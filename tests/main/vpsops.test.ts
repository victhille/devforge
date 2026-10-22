import { describe, expect, it } from 'vitest'
import { parseServices } from '../../src/main/services/vps/vpsServices'
import { fixCommand, overall, parseHealth } from '../../src/main/services/vps/vpsHealth'

const sections = (...s: string[]) => s.join('\n@@DF@@\n')

// What the real VPS answered (Ubuntu 24.04, 20 updates, fail2ban on, keys only)
const REAL = sections(
  'yes',
  '20\n0',
  'yes',
  '/dev/sda1         19221248 8661552  10543312      46% /\n/dev/sda1      2490368 344497 2145871   14% /',
  'Mem:      2063572992  1333579776   116891648    44699648   859394048   729993216',
  'tcp 0.0.0.0:22\ntcp 127.0.0.1:51821\ntcp 127.0.0.1:5678\ntcp 127.0.0.53%lo:53\ntcp [::]:22\nudp 0.0.0.0:51820\nudp 127.0.0.53%lo:53\nudp 203.0.113.10%ens3:68\nudp [::]:51820\nudp [fe80::f816:3eff:fe63:b4c3]%ens3:546',
  'port 22\npermitrootlogin without-password\npasswordauthentication no',
  'active',
  '353',
  'wg-easy|running|Up 5 hours (healthy)\nn8n-n8n-1|running|Up 2 days\ndb|running|Up 2 weeks\n--\n/wg-easy|0\n/n8n-n8n-1|0\n/db|0',
  'Images|66.34MB (2%)\nContainers|0B (0%)\nLocal Volumes|2.283kB (0%)\nBuild Cache|0B',
  'Ubuntu 24.04.5 LTS\nup 2 weeks, 2 days'
)

describe('VPS services', () => {
  it('finds the web interfaces, their port, and the ones open to the internet', () => {
    const s = parseServices([
      'portainer|portainer/portainer-ce:2.45.1|8000/tcp, 9443/tcp, 127.0.0.1:9000->9000/tcp|running|Up 2 weeks',
      'dbadmin|phpmyadmin:5.2.3|127.0.0.1:8080->80/tcp|running|Up 2 weeks',
      'db|mariadb:11.4|3306/tcp|running|Up 2 weeks',
      'wg-easy|ghcr.io/wg-easy/wg-easy:15.2.2|0.0.0.0:51820->51820/udp, [::]:51820->51820/udp, 127.0.0.1:51821->51821/tcp|running|Up',
      'blog|nginx:1.27|0.0.0.0:8081->80/tcp, [::]:8081->80/tcp|exited|Exited (0) 2 days ago',
      'cache|redis:7|0.0.0.0:6379->6379/tcp|running|Up'
    ].join('\n'))
    expect(s.map(x => [x.name, x.port, x.exposed, x.running])).toEqual([
      ['phpMyAdmin', 8080, false, true],
      ['Portainer', 9000, false, true],
      ['wg-easy', 51821, false, true],
      ['blog', 8081, true, false]
    ])
    expect(s.find(x => x.kind === 'portainer')!.scheme).toBe('http')
  })
})

describe('VPS health', () => {
  it('reads the real server: updates and a reboot to do, the rest fine', () => {
    const h = parseHealth(REAL, { sshPort: 22, keyAuth: true, now: new Date('2026-10-22T20:00:00Z') })
    const by = Object.fromEntries(h.checks.map(c => [c.id, c]))
    expect(h).toMatchObject({ sudo: true, os: 'Ubuntu 24.04.5 LTS', uptime: 'up 2 weeks, 2 days' })
    expect(by.updates).toEqual({ id: 'updates', level: 'warn', values: { count: 20, security: 0 }, fix: 'apt-upgrade' })
    expect(by.reboot).toMatchObject({ level: 'warn', fix: 'reboot' })
    expect(by.disk).toMatchObject({ level: 'ok', values: { percent: 46 } })
    expect(by.memory).toMatchObject({ level: 'ok', values: { available: 35 } })
    // Only SSH and WireGuard are reachable: expected
    expect(by.ports).toMatchObject({ level: 'ok', values: { ports: '' } })
    expect(by['ssh-root'].level).toBe('ok')
    expect(by['ssh-password'].level).toBe('ok')
    expect(by.fail2ban.level).toBe('ok')
    // Bots knock all day; with fail2ban on, that is fine
    expect(by['ssh-failures']).toMatchObject({ level: 'ok', values: { count: 353 } })
    expect(by.containers.level).toBe('ok')
    expect(by['docker-space']).toMatchObject({ level: 'ok' })
    expect(overall(h)).toBe('warn')
  })

  it('flags an exposed port, password logins, a crashed container, no fail2ban', () => {
    const bad = sections(
      'no', '3\n2', 'no',
      '/dev/sda1 100 92 8 92% /\n/dev/sda1 100 10 90 10% /',
      'Mem: 1000 950 10 0 40 50',
      'tcp 0.0.0.0:22\ntcp 0.0.0.0:3306\ntcp 0.0.0.0:443',
      'PermitRootLogin yes\nPasswordAuthentication yes\nPasswordAuthentication no',
      'inactive', '120',
      'api|exited|Exited (1) 3 hours ago\nweb|running|Up 1 hour\n--\n/api|0\n/web|9',
      'Images|2.5GB (80%)\nBuild Cache|1.2GB',
      ''
    )
    const h = parseHealth(bad, { sshPort: 22, keyAuth: false })
    const by = Object.fromEntries(h.checks.map(c => [c.id, c]))
    expect(by.updates).toMatchObject({ level: 'bad', values: { count: 3, security: 2 } })
    expect(by.disk.level).toBe('bad')
    expect(by.memory.level).toBe('bad')
    expect(by.ports).toMatchObject({ level: 'warn', values: { ports: 'tcp 3306' } })
    // First value wins, like sshd; no fix offered while DevForge logs in with a password
    expect(by['ssh-root']).toEqual({ id: 'ssh-root', level: 'bad', values: { value: 'yes' } })
    expect(by['ssh-password'].level).toBe('warn')
    expect(by.fail2ban).toMatchObject({ level: 'warn', fix: 'install-fail2ban' })
    expect(by['ssh-failures'].level).toBe('warn')
    expect(by.containers).toMatchObject({ level: 'bad', values: { broken: 'api', looping: 'web' } })
    expect(by['docker-space']).toMatchObject({ level: 'warn', fix: 'docker-prune' })
    expect(overall(h)).toBe('bad')
  })

  it('builds fixed commands only', () => {
    expect(fixCommand('ssh-harden')).toContain('/etc/ssh/sshd_config.d/00-devforge.conf')
    expect(fixCommand('ssh-harden')).toContain('sshd -t &&')
    expect(fixCommand('apt-upgrade')).toMatch(/^sudo -n env DEBIAN_FRONTEND=noninteractive apt-get update/)
    expect(() => fixCommand('rm -rf /' as never)).toThrow('Unknown fix')
  })
})
