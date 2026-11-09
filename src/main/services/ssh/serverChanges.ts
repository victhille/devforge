import type { SSHConnection } from '@shared/types'
import { isNewSshAddress, removeSshConnection, saveSshConnection } from './sshStorage'
import { closeForwardsOf } from './localForward'
import { forgetSession } from '../monitor/vpsWatch'
import { forgetApiKey } from '../n8n/n8nService'
import { forget as forgetVpnLogin } from '../vpn/vpnService'
import { forgetPasswordsThrough } from '../database/dbStorage'
import { forgetDetectedThrough } from '../database/dbDetect'
import { closeDb } from '../database/dbClient'

/**
 * What DevForge keeps for a server and sends through it: n8n's API key, the wg-easy login,
 * the passwords of the databases reached through it, and of those just detected on it. They
 * belong to the machine they were given for: when the server is removed or points to another
 * address, they are forgotten, and the sessions and forwards still open to the old address are
 * closed, so that none of it ever reaches another machine. An import does the same on the files
 * (storage/profile.ts, stripServerSecrets): a secret added here goes there too.
 */
export async function forgetServerSecrets(connectionId: string): Promise<void> {
  if (!connectionId) return
  const steps = [
    () => closeForwardsOf(connectionId),
    () => forgetSession(connectionId),
    () => forgetDetectedThrough(connectionId),
    () => forgetApiKey(connectionId),
    () => forgetVpnLogin(connectionId),
    async () => { await Promise.all(forgetPasswordsThrough(connectionId).map(closeDb)) }
  ]
  // Every step runs even when one before failed, so that as much as possible is forgotten; the first error is then told
  let failure: unknown = null
  for (const step of steps) {
    try { await step() } catch (err) { failure ??= err }
  }
  if (failure) throw failure
}

/**
 * Saves a server. A new one or a new address forgets first what was kept for it: if that
 * fails, the address is not saved, and the next try forgets again. Forgetting may wait for a
 * database still opening: a session or a detection begun meanwhile reached the old address,
 * so they are dropped again once the new one is saved.
 */
export async function saveServer(conn: SSHConnection): Promise<void> {
  if (!isNewSshAddress(conn)) return saveSshConnection(conn)
  await forgetServerSecrets(conn.id)
  saveSshConnection(conn)
  closeForwardsOf(conn.id)
  forgetSession(conn.id)
  forgetDetectedThrough(conn.id)
}

/** Removed, then forgotten: a server saved again with this id later is new, so it forgets again */
export async function removeServer(connectionId: string): Promise<void> {
  removeSshConnection(connectionId)
  await forgetServerSecrets(connectionId)
}
