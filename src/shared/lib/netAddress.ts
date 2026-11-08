/** 127.x.x.x or ::1: only this PC can reach the port */
export const isLoopback = (address: string | undefined): boolean => !!address && (/^127\./.test(address) || address === '::1' || address === 'localhost')

/** Any other address (0.0.0.0, ::, a network card's own address): other devices on the network can reach it */
export const reachableFromNetwork = (address: string | undefined): boolean => !!address && !isLoopback(address)
