const UPPER   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER   = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

export interface PasswordOptions { upper: boolean; lower: boolean; numbers: boolean; symbols: boolean }

/** Pick `length` chars from `alphabet` with crypto randomness, no modulo bias. */
function pick(alphabet: string, length: number): string {
  const out: string[] = []
  const limit = 256 - (256 % alphabet.length)
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length))) {
      if (b < limit) out.push(alphabet[b % alphabet.length])
      if (out.length === length) break
    }
  }
  return out.join('')
}

export function generatePassword(length: number, opts: PasswordOptions): string {
  let chars = ''
  if (opts.upper)   chars += UPPER
  if (opts.lower)   chars += LOWER
  if (opts.numbers) chars += NUMBERS
  if (opts.symbols) chars += SYMBOLS
  return pick(chars || LOWER + NUMBERS, length)
}

export type SecretFormat = 'hex' | 'base64' | 'alpha'

export function generateSecret(bytes: number, format: SecretFormat): string {
  if (format === 'alpha') return pick(LOWER + NUMBERS, bytes)
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  if (format === 'hex') return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  return btoa(String.fromCharCode(...arr)).replace(/=/g, '')
}

export function generateUuid(): string {
  return crypto.randomUUID()
}
