import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { IDE_CATALOG, ideArgs } from '../../src/shared/data/ides'
import { expandPattern, openInIde } from '../../src/main/services/system/ides'
import { tempDir } from '../helpers'

/** v3.5 lot 3: IDEs found on the PC, and those added by hand */
describe('v3.5: IDEs', () => {
  it('knows the usual IDEs, each once', () => {
    const ids = IDE_CATALOG.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['vscode', 'cursor', 'windsurf', 'antigravity', 'zed', 'sublime', 'phpstorm', 'webstorm', 'intellij', 'pycharm', 'rider', 'goland', 'visualstudio', 'notepadpp']))
  })

  it('finds a program in its install folder, the newest version first', () => {
    const root = tempDir('ide')
    for (const v of ['PhpStorm 2024.3', 'PhpStorm 2025.2']) {
      mkdirSync(join(root, 'JetBrains', v, 'bin'), { recursive: true })
      writeFileSync(join(root, 'JetBrains', v, 'bin', 'phpstorm64.exe'), '')
    }
    const env = { ProgramFiles: root }
    expect(expandPattern('%ProgramFiles%\\JetBrains\\PhpStorm*\\bin\\phpstorm64.exe', env)).toEqual([
      join(root, 'JetBrains', 'PhpStorm 2025.2', 'bin', 'phpstorm64.exe'),
      join(root, 'JetBrains', 'PhpStorm 2024.3', 'bin', 'phpstorm64.exe')
    ])
    // A variable that is not set finds nothing
    expect(expandPattern('%NOPE_NOT_SET%\\x.exe', env)).toEqual([])
  })

  it('builds the arguments of an IDE added by hand: {dir} replaced, quoted parts kept whole, the folder last otherwise', () => {
    expect(ideArgs('{dir}', 'C:\\Dev\\shop')).toEqual(['C:\\Dev\\shop'])
    expect(ideArgs('', 'C:\\Dev\\shop')).toEqual(['C:\\Dev\\shop'])
    expect(ideArgs('--new-window "{dir}"', 'C:\\My Dev\\shop')).toEqual(['--new-window', 'C:\\My Dev\\shop'])
    expect(ideArgs('-n', 'C:\\Dev\\shop')).toEqual(['-n', 'C:\\Dev\\shop'])
  })

  it('refuses an IDE it does not know, and opens nothing with "none"', async () => {
    const dir = tempDir('ide')
    await expect(openInIde(dir, 'nope')).rejects.toThrow('Unknown IDE')
    await expect(openInIde(dir, 'none')).resolves.toBeUndefined()
  })
})
