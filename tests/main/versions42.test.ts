import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readAllRequirements, readRequirements } from '../../src/main/services/versions/projectVersions'
import { tempDir } from '../helpers'

/** v4.2 lot 4: the versions a project asks for (Node, PHP, Python), the first file that says winning */

const project = (files: Record<string, string>) => {
  const dir = tempDir('versions')
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}

describe('readRequirements', () => {
  it('takes .nvmrc before .node-version, volta and engines; composer’s platform before its require', async () => {
    const dir = project({
      '.nvmrc': '22.11.0  # LTS\n', '.node-version': '20',
      'package.json': JSON.stringify({ volta: { node: '18.0.0' }, engines: { node: '>=16' } }),
      'composer.json': JSON.stringify({ require: { php: '^8.1' }, config: { platform: { php: '8.2.0' } } })
    })
    expect(await readRequirements(dir)).toEqual([
      { tool: 'node', range: '22.11.0', source: '.nvmrc' },
      { tool: 'php', range: '8.2.0', source: 'composer.json platform' }
    ])
  })

  it('falls back on volta, then engines; composer’s require', async () => {
    expect(await readRequirements(project({ 'package.json': JSON.stringify({ volta: { node: '20.1.0' }, engines: { node: '>=18' } }) })))
      .toEqual([{ tool: 'node', range: '20.1.0', source: 'package.json volta' }])
    expect(await readRequirements(project({ 'package.json': JSON.stringify({ engines: { node: '>=18' } }), 'composer.json': JSON.stringify({ require: { php: '>=8.3' } }) })))
      .toEqual([{ tool: 'node', range: '>=18', source: 'package.json engines' }, { tool: 'php', range: '>=8.3', source: 'composer.json' }])
  })

  it('reads Python from .python-version, else pyproject’s requires-python', async () => {
    expect(await readRequirements(project({ '.python-version': '3.12.4\n', 'pyproject.toml': 'requires-python = ">=3.10"' })))
      .toEqual([{ tool: 'python', range: '3.12.4', source: '.python-version' }])
    expect(await readRequirements(project({ 'pyproject.toml': '[project]\nname = "x"\nrequires-python = \'>=3.10\'\n' })))
      .toEqual([{ tool: 'python', range: '>=3.10', source: 'pyproject.toml' }])
  })

  it('says nothing for a folder with no such file, or files it cannot read', async () => {
    expect(await readRequirements(project({}))).toEqual([])
    expect(await readRequirements(project({ 'package.json': '{ not json', 'composer.json': '' }))).toEqual([])
    expect(await readRequirements(join(tempDir('gone'), 'missing'))).toEqual([])
  })
})

it('readAllRequirements gives each project its own list', async () => {
  const a = project({ '.nvmrc': '22' }), b = project({})
  expect(await readAllRequirements([a, b])).toEqual([
    { projectPath: a, requirements: [{ tool: 'node', range: '22', source: '.nvmrc' }] },
    { projectPath: b, requirements: [] }
  ])
})
