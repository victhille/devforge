import { describe, expect, it } from 'vitest'
import { scriptCommand, suggestRest } from '../../src/shared/lib/terminalSuggest'

/** v3.5 lot 6: the greyed rest of a terminal line */
describe('v3.5: terminal suggestions', () => {
  const sources = {
    scripts: ['npm run dev', 'npm run build'],
    history: ['npm run dev -- --host', 'git pull', 'git push origin main'],
    docs: ['git push --force-with-lease', 'docker logs -f <nom>', 'docker compose up -d']
  }

  it('takes the project scripts first, then the latest history, then the docs', () => {
    expect(suggestRest('npm run d', sources)).toBe('ev')
    expect(suggestRest('npm run dev ', sources)).toBe('-- --host')
    expect(suggestRest('git pu', sources)).toBe('sh origin main')
    expect(suggestRest('docker c', sources)).toBe('ompose up -d')
  })

  it('offers nothing for an empty line, a whole command, a placeholder or no match', () => {
    expect(suggestRest('', sources)).toBe('')
    expect(suggestRest('   ', sources)).toBe('')
    expect(suggestRest('git pull', sources)).toBe('')
    expect(suggestRest('docker l', sources)).toBe('')
    expect(suggestRest('ls -la', sources)).toBe('')
  })

  it('keeps what was typed, whatever its case', () => {
    expect(suggestRest('NPM run b', sources)).toBe('uild')
  })

  it('writes a script as each package manager runs it', () => {
    expect(scriptCommand('npm', 'dev')).toBe('npm run dev')
    expect(scriptCommand('pnpm', 'dev')).toBe('pnpm dev')
    expect(scriptCommand('yarn', 'build')).toBe('yarn build')
  })
})
