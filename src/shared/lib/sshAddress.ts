/** A saved SSH server's address, checked the same way by the main process and the server form */

/** A host name, an IPv4 or an IPv6 address (with its zone, fe80::1%eth0): no space, no `user@`, no leading dash */
export const isSshHost = (host: string): boolean => /^[\p{L}\p{N}._:%-]+$/u.test(host) && !host.startsWith('-')

/** \\server\share or //server/share: opening it makes Windows send the user's credentials to that server */
export const isNetworkPath = (path: string): boolean => /^[\\/]{2}/.test(path)

/** Optional: a file written by an older version or by hand may lack a field */
interface Address { host?: string; port?: number; username?: string }

/**
 * Same machine and account: the host compared as the known hosts compare it (without case or
 * surrounding spaces), 22 for a server saved without a port. What DevForge keeps for a server
 * (its password, n8n's key, the VPN login…) belongs to that address only.
 */
export const sameSshAddress = (a: Address, b: Address): boolean =>
  (a.host ?? '').trim().toLowerCase() === (b.host ?? '').trim().toLowerCase() &&
  (a.port ?? 22) === (b.port ?? 22) &&
  (a.username ?? '').trim() === (b.username ?? '').trim()
