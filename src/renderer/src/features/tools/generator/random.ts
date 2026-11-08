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

export interface SecretOptions {
  /** Base64 only: keep the "=" at the end (Laravel's APP_KEY has it) */
  padded?: boolean
  /** Base64 only: "-" and "_" instead of "+" and "/", no "=" (safe in a URL or a file name) */
  urlSafe?: boolean
}

export function generateSecret(bytes: number, format: SecretFormat, opts: SecretOptions = {}): string {
  if (format === 'alpha') return pick(LOWER + NUMBERS, bytes)
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  if (format === 'hex') return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  const b64 = btoa(String.fromCharCode(...arr))
  if (opts.urlSafe) return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return opts.padded ? b64 : b64.replace(/=/g, '')
}

/** Laravel's APP_KEY: "base64:" then 32 random bytes in base64, as `php artisan key:generate` writes it */
export function laravelAppKey(): string {
  return `base64:${generateSecret(32, 'base64', { padded: true })}`
}

/** Bits of randomness in a secret of `bytes` bytes ("alpha" draws one of 36 characters per byte) */
export function secretBits(bytes: number, format: SecretFormat): number {
  return format === 'alpha' ? Math.floor(bytes * Math.log2(36)) : bytes * 8
}

export function generateUuid(): string {
  return crypto.randomUUID()
}
