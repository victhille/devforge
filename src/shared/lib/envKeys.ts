import type { EnvProject } from '../types'

/** A template file: .env.example, .env.sample, .env.dist… */
export const isExample = (name: string) => /example|sample|dist|template/i.test(name)

/** A name the file can hold (the field already turns other characters into _): it cannot start with a digit */
export const isKeyName = (key: string) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)

/**
 * Keys holding a secret the app draws itself, by their exact name: never one a service gives
 * (GITHUB_CLIENT_SECRET, STRIPE_WEBHOOK_SECRET…) nor an encryption key whose data would be lost
 */
export const isRegenerable = (key: string) => /^(APP_KEY|APP_SECRET|SECRET_KEY|SESSION_SECRET|JWT_SECRET|AUTH_SECRET|NEXTAUTH_SECRET|BETTER_AUTH_SECRET|COOKIE_SECRET|CSRF_SECRET)$/i.test(key)

/**
 * A value shown in clear: only for keys known to hold settings, not secrets
 * (an allow list: an unknown key stays masked), and never an address that
 * carries a user and a password.
 */
export function isPlainValue(key: string, value: string): boolean {
  if (/:\/\/[^/\s@]*:[^/\s@]*@/.test(value)) return false
  if (/(SECRET|PASS|PWD|TOKEN|PRIVATE|CREDENTIAL|SALT|DSN|_KEY$|^KEY$|API_KEY)/i.test(key)) return false
  return /^(NODE_ENV|APP_ENV|APP_DEBUG|APP_NAME|APP_URL|APP_LOCALE|APP_TIMEZONE|TZ|PORT|HOST|LOG_LEVEL|LOG_CHANNEL|DEBUG)$/i.test(key)
    || /^(NEXT_PUBLIC|VITE|PUBLIC|NUXT_PUBLIC|EXPO_PUBLIC|REACT_APP)_/i.test(key)
    || /_(HOST|PORT|DRIVER|CONNECTION|MAILER|ENV|LOCALE|TIMEZONE|REGION|LEVEL|CHANNEL|FROM_ADDRESS|FROM_NAME)$/i.test(key)
}

/** Keys present in the template but missing from .env */
export function missingInEnv(env: EnvProject): string[] {
  const example = env.files.find(f => isExample(f.name))
  if (!example) return []
  const main = env.files.find(f => f.name === '.env')
  return Object.keys(example.values).filter(k => !main || !(k in main.values))
}
