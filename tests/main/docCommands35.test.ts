import { describe, expect, it } from 'vitest'
import { completeCommand } from '../../src/shared/lib/commandComplete'
import { checkCommand, listCommands, programOf, removeCommand, saveCommand } from '../../src/main/services/docs/docCommands'
import { EXPORTED } from '../../src/main/services/storage/profile'
import { DATA_ENTRIES } from '../../src/main/services/storage/migrations'
import { techIdFor, withCustom } from '../../src/renderer/src/features/docs/withCustom'
import type { DocTech } from '../../src/renderer/src/features/docs/data'

/** v3.5 lot 5: commands added to the Docs page */
describe('v3.5: custom commands', () => {
  const sources = { programs: ['git', 'gh', 'node', 'npm', 'npx', 'php'], commands: ['git log --oneline --graph', 'docker compose up -d'] }

  it('completes the first word with tools and PATH programs, then known sub-commands', () => {
    expect(completeCommand('g', sources)).toEqual(['git log --oneline --graph', 'git', 'gh'])
    expect(completeCommand('git ch', sources)).toEqual(['git checkout', 'git cherry-pick'])
    expect(completeCommand('php artisan mi', sources)).toEqual(['php artisan migrate', 'php artisan migrate:fresh'])
    expect(completeCommand('php bin/console make:e', sources)).toEqual(['php bin/console make:entity'])
    expect(completeCommand('docker compose u', sources)).toEqual(['docker compose up -d', 'docker compose up'])
    expect(completeCommand('', sources)).toEqual([])
  })

  it('saves, changes and removes a command, and checks its program on this PC', async () => {
    const [added] = saveCommand({ cmd: '  php artisan migrate:fresh --seed ', desc: 'Rebuild the database', category: 'Laravel' })
    expect(added).toMatchObject({ cmd: 'php artisan migrate:fresh --seed', category: 'Laravel' })
    saveCommand({ ...added, desc: 'Empty and fill the database' })
    expect(listCommands()).toHaveLength(1)
    expect(listCommands()[0].desc).toBe('Empty and fill the database')
    expect(() => saveCommand({ cmd: 'x', category: ' ' })).toThrow()
    expect(removeCommand(added.id)).toEqual([])

    expect(programOf('php bin/console cache:clear')).toBe('php')
    // node runs these tests, so it is in PATH; this one is not
    expect((await checkCommand('node --version')).found).toBe(true)
    expect(await checkCommand('surely-not-a-program-xyz --help')).toEqual({ program: 'surely-not-a-program-xyz', found: false })
  })

  it('travels with the data: backed up and exported', () => {
    expect(DATA_ENTRIES).toContain('doc-commands.json')
    expect(EXPORTED).toContain('doc-commands.json')
  })

  it('puts a command in its reference, first, or in a reference of its own', () => {
    const docs = [{ id: 'git', name: 'Git', color: '#F05032', sections: [{ title: 'Base', entries: [{ cmd: 'git status', desc: '' }] }] }] as DocTech[]
    const mine = (category: string, cmd: string) => ({ id: cmd, cmd, desc: '', category, createdAt: '' })
    const out = withCustom(docs, [mine('git', 'git lg'), mine('VPS', 'ssh vps'), mine('vps ', 'htop')], 'My commands')
    expect(out[0].sections.map(s => s.title)).toEqual(['My commands', 'Base'])
    expect(out[1]).toMatchObject({ id: 'custom:vps', name: 'VPS' })
    expect(out[1].sections[0].entries.map(e => e.cmd)).toEqual(['ssh vps', 'htop'])
    expect(techIdFor(docs, 'GIT')).toBe('git')
    expect(techIdFor(docs, 'VPS')).toBe('custom:vps')
  })
})
