import { describe, expect, it } from 'vitest'
import { isNetworkPath, isSshHost, sameSshAddress } from '../../src/shared/lib/sshAddress'

/** The address rules the main process and the server form share */
describe('SSH address', () => {
  it('takes host names and IP addresses, nothing ssh2 would misread', () => {
    for (const ok of ['vps.example.org', '203.0.113.10', '2001:db8::1', 'fe80::1%eth0', 'my-server_2']) expect(isSshHost(ok), ok).toBe(true)
    for (const bad of ['', 'root@vps', 'my server', '-oProxyCommand=calc', '[::1]', 'vps/admin']) expect(isSshHost(bad), bad).toBe(false)
  })

  it('spots network shares, whatever the slashes', () => {
    expect(isNetworkPath('\\\\server\\share\\id')).toBe(true)
    expect(isNetworkPath('//server/share/id')).toBe(true)
    expect(isNetworkPath('C:\\Users\\me\\.ssh\\id_ed25519')).toBe(false)
    expect(isNetworkPath('/home/me/.ssh/id_ed25519')).toBe(false)
  })

  it('the same machine and account: host without case or spaces, port 22 when absent', () => {
    const saved = { host: 'VPS.example.org', username: 'deploy' }
    expect(sameSshAddress(saved, { host: ' vps.example.org ', port: 22, username: 'deploy' })).toBe(true)
    expect(sameSshAddress(saved, { host: 'vps.example.org', port: 2222, username: 'deploy' })).toBe(false)
    expect(sameSshAddress(saved, { host: 'vps.example.org', username: 'root' })).toBe(false)
    expect(sameSshAddress(saved, { host: 'other.example.org', username: 'deploy' })).toBe(false)
  })
})
