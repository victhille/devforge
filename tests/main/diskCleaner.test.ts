import { mkdirSync, symlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { folderSize, robocopyBytes, scanForCleanable } from '../../src/main/services/cleaner/diskCleaner'
import { tempDir } from '../helpers'

/** robocopy's summary, as Windows prints it in English and in French (/BYTES: plain numbers) */
const EN = `
               Total    Copied   Skipped  Mismatch    FAILED    Extras
    Dirs :        12        12         0         0         0         0
   Files :       345       345         0         0         0         0
   Bytes :   1234567   1234567         0         0         0         0
   Times :   0:00:00   0:00:00                       0:00:00   0:00:00
`
const FR = `
                  Total    CopiÚ    IgnorÚ  Discordance      ╔CHEC    Extras
         RÚp. :      12        12         0         0         0         0
    Fichiers :      345       345         0         0         0         0
      Octets :  7654321   7654321         0         0         0         0
       Heures :   0:00:00   0:00:00                       0:00:00   0:00:00
`

describe('disk cleaner: sizes', () => {
  it('reads the total bytes in robocopy’s summary, whatever Windows’ language', () => {
    expect(robocopyBytes(EN)).toBe(1234567)
    expect(robocopyBytes(FR)).toBe(7654321)
    expect(robocopyBytes('ERROR 3 (0x00000003) The system cannot find the path specified.')).toBeNull()
  })

  it('a folder found by the scan: its files’ bytes, links not followed', async () => {
    const root = tempDir('cleaner')
    const app = join(root, 'shop')
    const deps = join(app, 'node_modules', 'left-pad', 'lib')
    mkdirSync(deps, { recursive: true })
    writeFileSync(join(app, 'package.json'), '{}')
    writeFileSync(join(deps, 'index.js'), 'x'.repeat(1000))
    writeFileSync(join(app, 'node_modules', 'left-pad', 'package.json'), 'y'.repeat(234))
    // A big file elsewhere, reached through a link (as pnpm's store): never counted
    const store = join(root, 'store')
    mkdirSync(store)
    writeFileSync(join(store, 'big.bin'), Buffer.alloc(50_000))
    try { symlinkSync(store, join(app, 'node_modules', 'linked'), 'junction') } catch { /* no links here: the count stays the same */ }

    const found = await scanForCleanable(root)
    expect(found.map(f => f.name)).toEqual(['node_modules'])
    expect(await folderSize(found[0].path)).toBe(1234)
    // Only what the last scan found
    await expect(folderSize(store)).rejects.toThrow(/last scan/)
  })
})
