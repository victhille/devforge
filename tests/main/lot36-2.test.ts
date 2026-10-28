import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'

/** v3.6 lot 2: Forgy and the packages of the other languages */
const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const REQUIREMENTS = 'Django>=4.2\nrequests==2.31.0\n'

function pythonProject(): string {
  const root = tempDir('py')
  file(join(root, 'requirements.txt'), REQUIREMENTS)
  file(join(root, '.venv', 'pyvenv.cfg'), 'home = C:\\Python312\n')
  file(join(root, '.venv', 'Scripts', 'python.exe'), '')
  mkdirSync(join(root, '.venv', 'Lib', 'site-packages', 'Django-4.2.11.dist-info'), { recursive: true })
  mkdirSync(join(root, '.venv', 'Lib', 'site-packages', 'requests-2.31.0.dist-info'), { recursive: true })
  file(join(root, 'App', 'App.csproj'), '<Project><ItemGroup><PackageReference Include="Serilog" Version="3.1.1" /></ItemGroup></Project>')
  return root
}

afterEach(() => { delete process.env.DEVFORGE_TEST_PACKAGES })

describe('v3.6 lot 2: Forgy and the other languages', () => {
  it('reports Python packages with their own ranges, the audit, and .NET as read only', async () => {
    const root = pythonProject()
    const data = join(tempDir('t'), 'packages.json')
    writeFileSync(data, JSON.stringify({
      latest: { Django: '5.1.2', requests: '2.32.3', Serilog: '4.0.0' },
      audit: { total: 1, bySeverity: { unknown: 1, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: { Django: 'unknown' } }
    }))
    process.env.DEVFORGE_TEST_PACKAGES = data
    const { packagesReport } = await import('../../src/main/services/assistant/packageTools')
    const report = await packagesReport({ id: 'p', name: 'Api', path: root } as never, true)
    expect(report).toContain('requirements.txt (pip): 2 packages, 2 to look at')
    // >=4.2 lets 5.1.2 in; ==2.31.0 does not let 2.32.3 in
    expect(report).toContain('- Django 4.2.11 → 5.1.2 (major, within its range)')
    expect(report).toContain('- requests 2.31.0 → 2.32.3 (minor, needs a range change)')
    expect(report).toContain('Vulnerabilities: 1 (unknown 1) — Django: unknown')
    expect(report).toContain('App/App.csproj (nuget, read only: DevForge does not update it (dotnet list package --outdated))')
  })

  it('updates a Python package through an approved card, and its undo puts the file back', async () => {
    const root = pythonProject()
    const data = join(tempDir('t'), 'packages.json')
    writeFileSync(data, JSON.stringify({
      latest: { requests: '2.32.3' },
      update: `node -e "require('fs').writeFileSync('requirements.txt','updated')"`,
      install: 'node -e "process.exit(0)"'
    }))
    process.env.DEVFORGE_TEST_PACKAGES = data
    const { updatePackagesPlan } = await import('../../src/main/services/assistant/packageTools')
    const { restoreAndInstall } = await import('../../src/main/services/packages/projectPackages')

    const plan = await updatePackagesPlan({ id: 'p', name: 'Api', path: root } as never, ['requests'], 'latest', undefined)
    expect(plan.preview).toContain('requirements.txt (pip)')
    expect(plan.preview).toContain('- requests: 2.31.0 → 2.32.3')
    expect(plan.preview).toContain('requirements.txt and its lockfile are saved first')

    const { undo } = await plan.run()
    expect(readFileSync(join(root, 'requirements.txt'), 'utf-8')).toBe('updated')
    expect(undo).toMatchObject({ type: 'packages-restore', file: 'requirements.txt', files: ['requirements.txt'] })
    expect(await restoreAndInstall(root, undo.dir, undo.file, undo)).toBe(true)
    expect(readFileSync(join(root, 'requirements.txt'), 'utf-8')).toBe(REQUIREMENTS)
  })

  it('refuses .NET packages, and says what is missing', async () => {
    const root = pythonProject()
    const data = join(tempDir('t'), 'packages.json')
    writeFileSync(data, JSON.stringify({ latest: {} }))
    process.env.DEVFORGE_TEST_PACKAGES = data
    const { updatePackagesPlan } = await import('../../src/main/services/assistant/packageTools')
    await expect(updatePackagesPlan({ id: 'p', name: 'Api', path: root } as never, ['Serilog'], 'latest', undefined)).rejects.toThrow(/DevForge does not update nuget packages/)

    writeFileSync(data, JSON.stringify({ latest: {}, missingTool: 'cargo' }))
    file(join(root, 'cli', 'Cargo.toml'), '[package]\nname = "cli"\n[dependencies]\nclap = "4.5"\n')
    await expect(updatePackagesPlan({ id: 'p', name: 'Api', path: root } as never, ['clap'], 'compatible', 'cli/Cargo.toml')).rejects.toThrow(/cargo is missing on this PC/)
  })
})
