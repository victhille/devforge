import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { saveProjects, tempDir } from '../helpers'

const expo = await import('../../src/main/services/expo/expoService')

const pkg = (dir: string, deps: Record<string, string>, name?: string) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, dependencies: deps }))
}

/** Expo: which folders are apps, the command line, and what Metro prints */
describe('Expo', () => {
  it('finds an Expo app at the root of a project and in a monorepo, and nothing else', () => {
    const solo = tempDir('recipes')
    pkg(solo, { expo: '~53.0.4', 'expo-router': '5.0.0' })
    const mono = tempDir('freelance')
    pkg(mono, { turbo: '2.0.0' })
    pkg(join(mono, 'apps', 'mobile'), { expo: '^54.0.0', 'expo-dev-client': '6.0.0' }, '@freelance/mobile')
    pkg(join(mono, 'apps', 'web'), { next: '16.0.0' })
    pkg(join(mono, 'node_modules', 'expo'), { expo: '54.0.0' })
    const web = tempDir('site')
    pkg(web, { vite: '7.0.0' })
    saveProjects([
      { name: 'recipes', path: solo },
      { name: 'freelance', path: mono },
      { name: 'site', path: web }
    ])

    expect(expo.expoProjects()).toEqual([
      { id: 'p0', projectId: 'p0', name: 'recipes', label: 'recipes', sdk: 53, router: true, devClient: false },
      { id: 'p1/apps/mobile', projectId: 'p1', name: '@freelance/mobile', label: 'freelance/apps/mobile', sdk: 54, router: false, devClient: true }
    ])
  })

  it('builds `expo start` from fixed words, and refuses options that are not', () => {
    expect(expo.startArgs({ target: 'go', connection: 'lan', port: 8082, clear: false })).toEqual(['expo', 'start', '--port', '8082', '--go'])
    expect(expo.startArgs({ target: 'dev', connection: 'tunnel', port: 8081, clear: true })).toEqual([
      'expo',
      'start',
      '--port',
      '8081',
      '--dev-client',
      '--tunnel',
      '--clear'
    ])
    expect(expo.startArgs({ target: 'go', connection: 'localhost', port: 19000, clear: false })).toContain('--localhost')

    const ok = { target: 'go', connection: 'lan', port: 8081, clear: false } as const
    expect(() => expo.checkOptions({ ...ok, port: 80 })).toThrow('Port')
    expect(() => expo.checkOptions({ ...ok, port: 8081.5 })).toThrow('Port')
    expect(() => expo.checkOptions({ ...ok, target: '--go & calc' as 'go' })).toThrow('Invalid target')
    expect(() => expo.checkOptions({ ...ok, connection: 'lan --offline' as 'lan' })).toThrow('Invalid connection')
    expect(expo.checkOptions({ ...ok, clear: 'yes' as unknown as boolean }).clear).toBe(false)
  })

  it('reads Metro: colors and rewrites gone, the exp:// address, the packages off the SDK', () => {
    expect(expo.cleanLine('\x1b[2K\x1b[1G\x1b[32mStarting\x1b[39m\rStarting Metro Bundler')).toBe('Starting Metro Bundler')
    expect(expo.urlIn('› Metro waiting on exp://192.168.1.71:8082')).toBe('exp://192.168.1.71:8082')
    expect(expo.urlIn('› Metro waiting on exp+freelance://expo-development-client/?url=http%3A%2F%2F192.168.1.71%3A8081')).toMatch(/^exp\+freelance:\/\//)
    expect(expo.urlIn('Logs for your project will appear below.')).toBeNull()
    expect(expo.sdkOf('~54.0.12')).toBe(54)
    expect(expo.sdkOf('latest')).toBeNull()

    const out = [
      'The following packages should be updated for best compatibility with the installed expo version:',
      '  react-native-reanimated@3.10.1 - expected version: ~3.16.1',
      '  @shopify/flash-list@1.6.0 - expected version: 1.7.6',
      'Your project may not work correctly until you install the expected versions of the packages.'
    ].join('\n')
    expect(expo.parseCheck(out)).toEqual([
      { name: 'react-native-reanimated', installed: '3.10.1', expected: '~3.16.1' },
      { name: '@shopify/flash-list', installed: '1.6.0', expected: '1.7.6' }
    ])
  })

  it('sends only the terminal keys it knows, and only to a running server', () => {
    expect(() => expo.sendKey('r')).toThrow('not running')
    expect(() => expo.sendKey('\x03' as 'r')).toThrow('Invalid key')
    expect(() => expo.answerNgrok()).toThrow('not asking')
  })
})
