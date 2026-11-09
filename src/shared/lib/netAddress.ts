/** 127.x.x.x or ::1: only this PC can reach the port */
export const isLoopback = (address: string | undefined): boolean => !!address && (/^127\./.test(address) || address === '::1' || address === 'localhost')

/**
 * An IP address of a private network (RFC 1918 and loopback, IPv6 unique local and loopback):
 * a Docker container's on its server, never a machine of the internet. Names are not addresses.
 */
export function isPrivateAddress(address: string): boolean {
  // Canonical bytes only: 010.0.0.1 is read as octal (8.0.0.1, public) by some resolvers
  const byte = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
  const v4 = new RegExp(`^${byte}\\.${byte}\\.${byte}\\.${byte}$`).exec(address)
  if (v4) {
    const [a, b] = v4.slice(1).map(Number)
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  const v6 = address.toLowerCase()
  return v6 === '::1' || /^f[cd][0-9a-f]{2}:[0-9a-f:]*$/.test(v6)
}

/** Any other address (0.0.0.0, ::, a network card's own address): other devices on the network can reach it */
export const reachableFromNetwork = (address: string | undefined): boolean => !!address && !isLoopback(address)
