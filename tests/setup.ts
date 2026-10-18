import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll } from 'vitest'

/** Fresh userData folder per test file: storages never touch the real app data */
const dir = mkdtempSync(join(tmpdir(), 'devforge-test-'))
process.env.DEVFORGE_TEST_USERDATA = dir
afterAll(() => rmSync(dir, { recursive: true, force: true }))
