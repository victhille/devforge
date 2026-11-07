import { describe, expect, it } from 'vitest'
import { fileArgs } from '../../src/main/services/system/ides'

/** v3.5.4: a file opens in its project's window, not in the last one used */
describe('v3.5.4: a file opened in the IDE', () => {
  const file = 'C:\\code\\agenda\\frontend\\src\\Logo.vue'
  const root = 'C:\\code\\agenda'

  it('gives VS Code, Cursor, Windsurf, Antigravity and Zed the project folder first', () => {
    for (const ide of ['vscode', 'cursor', 'windsurf', 'antigravity', 'zed']) expect(fileArgs(ide, file, root)).toEqual([root, file])
  })

  it('gives the others the file alone, and everyone the file alone without a folder', () => {
    expect(fileArgs('phpstorm', file, root)).toEqual([file])
    expect(fileArgs('notepadpp', file, root)).toEqual([file])
    expect(fileArgs('vscode', file, null)).toEqual([file])
  })
})
