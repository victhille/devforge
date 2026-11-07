import type { EnvSyncDiff, EnvSyncKey } from '@shared/types'
import { log } from '../../lib/log'
import { runOn } from '../monitor/vpsWatch'
import { shQuote } from '../ssh/sshClient'
import { listTargets } from '../deploy/deployService'
import { applyEnvChanges, backupEnv, isEnvName, parseEnv, readEnvProject, writeEnvValues } from './envFiles'

/**
 * A project's .env next to the one of its deployed copy (a deploy target:
 * server + folder). The values never leave the main process: the window gets
 * the state of each key only, then says which keys go which way. A file is
 * saved before it is written (an encrypted copy here, a .bak on the server).
 */

const SEP = '@@DF@@'

function target(targetId: string) {
  const t = listTargets().find(x => x.id === targetId)
  if (!t) throw new Error('Unknown deploy target')
  if (!t.projectPath) throw new Error('NO_PROJECT')
  return t as typeof t & { projectPath: string }
}

const remoteFile = (remotePath: string, name: string) => `${remotePath.replace(/\/+$/, '')}/${name}`

/** The server's file: its text, or null when it does not exist */
async function readRemote(connectionId: string, path: string): Promise<string | null> {
  const out = await runOn(connectionId, `if [ -f ${shQuote(path)} ]; then cat ${shQuote(path)}; echo '${SEP}yes'; else echo '${SEP}no'; fi`, 30_000)
  const i = out.lastIndexOf(SEP)
  return out.slice(i + SEP.length).trim() === 'yes' ? out.slice(0, i).replace(/\n$/, '') : null
}

export function compareEnv(local: Record<string, string>, remote: Record<string, string>): EnvSyncKey[] {
  const keys = [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort((a, b) => a.localeCompare(b))
  return keys.map(key => ({
    key,
    status: !(key in remote) ? 'local' : !(key in local) ? 'remote' : local[key] === remote[key] ? 'same' : 'different'
  }))
}

export async function diffEnv(targetId: string, localName: string, remoteName: string): Promise<EnvSyncDiff> {
  if (!isEnvName(localName) || !isEnvName(remoteName)) throw new Error('Not an env file')
  const t = target(targetId)
  const local = (await readEnvProject(t.projectPath)).files.find(f => f.name === localName)?.values ?? {}
  const text = await readRemote(t.connectionId, remoteFile(t.remotePath, remoteName))
  return { localName, remoteName, remotePath: remoteFile(t.remotePath, remoteName), remoteExists: text !== null, keys: compareEnv(local, text === null ? {} : parseEnv(text)) }
}

/**
 * 'push': the server's file takes the chosen keys from this PC (a key missing
 * here is removed there); 'pull': the other way.
 */
export async function applyEnv(targetId: string, localName: string, remoteName: string, direction: 'push' | 'pull', keys: string[]): Promise<{ changed: number; backup: string | null }> {
  if (!isEnvName(localName) || !isEnvName(remoteName)) throw new Error('Not an env file')
  if (direction !== 'push' && direction !== 'pull') throw new Error('Invalid direction')
  const t = target(targetId)
  const path = remoteFile(t.remotePath, remoteName)
  const local = (await readEnvProject(t.projectPath)).files.find(f => f.name === localName)?.values ?? {}
  const text = await readRemote(t.connectionId, path)
  const remote = text === null ? {} : parseEnv(text)
  const [from, to] = direction === 'push' ? [local, remote] : [remote, local]
  const changes: Record<string, string | null> = {}
  for (const key of keys) {
    if (typeof key !== 'string' || !(key in from || key in to)) continue
    const value = key in from ? from[key]! : null
    if (to[key] !== value && !(value === null && !(key in to))) changes[key] = value
  }
  const changed = Object.keys(changes).length
  if (!changed) return { changed: 0, backup: null }

  if (direction === 'pull') {
    // An encrypted copy of the project's .env files first
    await backupEnv(t.projectPath)
    await writeEnvValues(t.projectPath, localName, changes)
    log('info', 'env', `${changed} key(s) of ${remoteName} pulled into ${t.projectPath}`)
    return { changed, backup: 'DevForge' }
  }

  const next = applyEnvChanges(text ?? '', changes)
  const backup = text === null ? null : `${path}.devforge-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`
  const b64 = Buffer.from(next, 'utf-8').toString('base64')
  const out = await runOn(t.connectionId, [
    'set -e',
    backup ? `cp -p ${shQuote(path)} ${shQuote(backup)}` : 'umask 077',
    // Written in place: the file keeps its owner and rights
    `echo ${b64} | base64 -d > ${shQuote(path)}`,
    `echo '${SEP}ok'`
  ].join('\n'), 30_000)
  if (!out.includes(`${SEP}ok`)) throw new Error(out.trim().slice(-300) || 'Could not write the file on the server')
  log('info', 'env', `${changed} key(s) pushed to ${t.connectionId}:${path}`)
  return { changed, backup }
}
