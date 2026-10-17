import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { DomainsStatus, LocalDomain } from '@shared/types'
import { HOSTS_PATH, managedDomains, readHosts, withManagedBlock, writeHostsElevated } from './hostsFile'
import { proxyState, syncProxy } from './domainProxy'

/** Only reserved TLDs that never hit real DNS */
export const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(test|localhost)$/

function storePath(): string {
  return join(app.getPath('userData'), 'domains.json')
}

export function listDomains(): LocalDomain[] {
  const p = storePath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) as LocalDomain[] } catch { return [] }
}

function persist(list: LocalDomain[]): void {
  const p = storePath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8')
}

export async function saveDomain(d: LocalDomain): Promise<void> {
  const domain = d.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Use a name ending in .test or .localhost (e.g. shop.test)')
  if (!Number.isInteger(d.port) || d.port < 1 || d.port > 65535) throw new Error('Invalid port')
  const list = listDomains()
  if (list.some(x => x.domain === domain && x.id !== d.id)) throw new Error('This domain already exists')
  const i = list.findIndex(x => x.id === d.id)
  const item = { ...d, domain }
  if (i >= 0) list[i] = item; else list.push(item)
  persist(list)
  await syncProxy(list)
}

export async function removeDomain(id: string): Promise<void> {
  const list = listDomains().filter(d => d.id !== id)
  persist(list)
  await syncProxy(list)
}

/** .localhost resolves to 127.0.0.1 without the hosts file in browsers */
const needsHosts = (list: LocalDomain[]) => list.filter(d => d.enabled && !d.domain.endsWith('.localhost')).map(d => d.domain)

export function domainsStatus(): DomainsStatus {
  const wanted = needsHosts(listDomains()).sort()
  const current = [...new Set(managedDomains())].sort()
  return { ...proxyState(), hostsInSync: wanted.join() === current.join(), hostsPath: HOSTS_PATH }
}

export function applyHosts() {
  return writeHostsElevated(withManagedBlock(readHosts(), needsHosts(listDomains())))
}

export const startDomains = () => syncProxy(listDomains())
