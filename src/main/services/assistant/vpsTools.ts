import type { Project } from '@shared/types'
import { loadSshConnections } from '../ssh/sshStorage'
import { readHealth } from '../vps/vpsHealth'
import { listServices } from '../vps/vpsServices'
import { listPlans, state as backupState } from '../backups/backupsService'
import { status as githubStatus } from '../github/githubService'
import { ToolError } from './assistantTools'

/**
 * Forgy's view of the VPS (health, services, backups) and of GitHub: short
 * plain-text answers the model can read. No secret is ever in them.
 */

/** The server meant by "server" (its SSH name); optional when only one is saved */
export function sshServer(ref: unknown): { id: string; name: string } {
  const conns = loadSshConnections()
  if (!conns.length) throw new ToolError('No SSH server is saved in DevForge (page SSH).')
  if (typeof ref !== 'string' || !ref.trim()) {
    if (conns.length === 1) return { id: conns[0]!.id, name: conns[0]!.name }
    throw new ToolError(`Several servers: ${conns.map(c => c.name).join(', ')}. Pass "server".`)
  }
  const hit = conns.find(c => c.name.toLowerCase() === ref.trim().toLowerCase() || c.id === ref.trim() || c.host === ref.trim())
  if (!hit) throw new ToolError(`Unknown server "${ref}". Servers: ${conns.map(c => c.name).join(', ')}`)
  return { id: hit.id, name: hit.name }
}

const err = (e: unknown) => { throw new ToolError(e instanceof Error ? e.message : String(e)) }

export async function vpsHealthText(server: unknown): Promise<string> {
  const s = sshServer(server)
  const h = await readHealth(s.id).catch(err)
  const lines = h.checks.map(c => `- ${c.id}: ${c.level.toUpperCase()}${Object.keys(c.values).length ? ` ${JSON.stringify(c.values)}` : ''}${c.fix ? ` (fix available in DevForge: ${c.fix})` : ''}`)
  return `${s.name} · ${h.os ?? '?'} · ${h.uptime ?? ''} · passwordless sudo: ${h.sudo ? 'yes' : 'no'}\n${lines.join('\n')}\nFixes run only from Serveurs › Santé, after the user's click.`
}

export async function vpsServicesText(server: unknown): Promise<string> {
  const s = sshServer(server)
  const list = await listServices(s.id).catch(err)
  if (!list.length) return `${s.name}: no web interface in the containers.`
  return list.map(x => `- ${x.name} (${x.image}) port ${x.port} ${x.running ? 'running' : 'stopped'}${x.exposed ? ' OPEN TO THE INTERNET' : ' local only'}`).join('\n') + '\nThe user opens them from Serveurs › Services (SSH tunnel).'
}

export async function backupsText(server: unknown): Promise<string> {
  const s = sshServer(server)
  if (!listPlans().some(p => p.connectionId === s.id)) return `${s.name}: nightly backups are not turned on (Serveurs › Sauvegardes).`
  const st = await backupState(s.id).catch(err)
  const last = st.last
  const age = last ? Math.round((Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000) : null
  return [
    `${s.name}: nightly backup at ${st.plan?.time} (${st.plan?.keepDaily} days, ${st.plan?.keepWeekly} weeks), cron ${st.scheduled ? 'in place' : 'MISSING'}`,
    last ? `Last: ${last.day} ${last.ok ? 'OK' : 'FAILED'}, ${age} h ago, ${last.size} bytes` : 'No backup yet',
    ...(last?.items ?? []).filter(i => !i.ok).map(i => `- failed: ${i.name}: ${i.error}`),
    `Copy on this PC: ${st.local.day ?? 'none'}${st.local.error ? ` (error: ${st.local.error})` : ''}`,
    `Files on the server: ${st.files.length}`
  ].join('\n')
}

export async function githubText(p: Project): Promise<string> {
  const st = await githubStatus(p.path).catch(e => {
    const m = e instanceof Error ? e.message : String(e)
    throw new ToolError(m === 'NO_TOKEN' ? 'GitHub is not connected: the user signs in with `gh auth login` or saves a token on the project page, tab GitHub.' : m === 'NOT_GITHUB' ? `${p.name} has no GitHub origin.` : m)
  })
  return [
    `${st.repo.owner}/${st.repo.repo}`,
    'Actions (newest first):',
    ...st.runs.map(r => `- run ${r.id} ${r.name} #${r.number} [${r.status === 'completed' ? r.conclusion : r.status}] ${r.branch} "${r.title}" ${r.createdAt}`),
    `Open pull requests: ${st.pulls.length ? '' : 'none'}`,
    ...st.pulls.map(x => `- #${x.number} ${x.title} (${x.author}, ${x.branch}${x.draft ? ', draft' : ''})`),
    'Releases:',
    ...st.releases.map(r => `- ${r.tag}${r.prerelease ? ' (pre-release)' : ''} ${r.publishedAt ?? ''}`)
  ].join('\n')
}
