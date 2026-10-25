import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { TOOLS, ToolError, isSecretFile, runTool } from '../../src/main/services/assistant/assistantTools'
import { getApiKey, getConfig, saveConfig } from '../../src/main/services/assistant/assistantStorage'
import { saveProjects, tempDir, userData } from '../helpers'

function project() {
  const dir = tempDir('proj')
  mkdirSync(join(dir, 'src'))
  mkdirSync(join(dir, 'node_modules', 'big'), { recursive: true })
  writeFileSync(join(dir, 'src', 'app.ts'), 'export const greeting = "bonjour"\nconsole.log(greeting)\n')
  writeFileSync(join(dir, '.env'), 'DB_PASSWORD=hunter2\n')
  writeFileSync(join(dir, '.env.example'), 'DB_PASSWORD=\n')
  writeFileSync(join(dir, 'id_rsa'), 'PRIVATE')
  writeFileSync(join(dir, 'node_modules', 'big', 'x.js'), 'bonjour from deps')
  saveProjects([{ name: 'Shop', path: dir }])
  return dir
}

describe('secret files', () => {
  it.each(['.env', '.env.local', '.env.production', 'id_rsa', 'server.pem', 'cert.key', '.npmrc', 'credentials.json'])('%s is secret', f => {
    expect(isSecretFile(`/p/${f}`)).toBe(true)
  })
  it.each(['.env.example', '.env.sample', 'app.ts', 'keys.ts', 'README.md'])('%s is not', f => {
    expect(isSecretFile(`/p/${f}`)).toBe(false)
  })
})

describe('assistant tools', () => {
  it('reads project files with line numbers, by project name', async () => {
    project()
    const out = await runTool('read_file', { project: 'shop', path: 'src/app.ts' })
    expect(out).toContain('src/app.ts (lines 1-3 of 3)')
    expect(out).toContain('    1  export const greeting = "bonjour"')
    expect(await runTool('read_file', { project: 'Shop', path: 'src/app.ts', from_line: 2, to_line: 2 })).toContain('    2  console.log(greeting)')
  })

  it('never reads secrets or leaves the project', async () => {
    project()
    await expect(runTool('read_file', { project: 'Shop', path: '.env' })).rejects.toThrow(ToolError)
    await expect(runTool('read_file', { project: 'Shop', path: 'id_rsa' })).rejects.toThrow(/secrets/)
    await expect(runTool('read_file', { project: 'Shop', path: '../../projects.json' })).rejects.toThrow(/outside/)
    await expect(runTool('read_file', { project: 'Shop', path: join(userData(), 'projects.json') })).rejects.toThrow(/outside/)
    expect(await runTool('read_file', { project: 'Shop', path: '.env.example' })).toContain('DB_PASSWORD=')
  })

  it('refuses unknown projects and tools, and malformed input', async () => {
    project()
    await expect(runTool('read_file', { project: 'Nope', path: 'a' })).rejects.toThrow(/Unknown project "Nope". Saved projects: Shop/)
    await expect(runTool('rm_rf', {})).rejects.toThrow(/Unknown tool/)
    await expect(runTool('read_file', 'oops')).rejects.toThrow(/object/)
    await expect(runTool('read_file', { project: 'Shop' })).rejects.toThrow(/path/)
  })

  it('shows 250 lines by default and says how to read the rest', async () => {
    const dir = project()
    writeFileSync(join(dir, 'src', 'big.ts'), Array.from({ length: 600 }, (_, i) => `line ${i + 1}`).join('\n'))
    const out = await runTool('read_file', { project: 'Shop', path: 'src/big.ts' })
    expect(out).toContain('(lines 1-250 of 600)')
    expect(out).toContain('lines 251-600 not shown')
    expect(out).not.toContain('line 251\n')
  })

  it('lists files and searches without dependencies or secrets', async () => {
    project()
    const tree = await runTool('list_files', { project: 'Shop' })
    expect(tree).toContain('src/')
    expect(tree).toContain('  app.ts')
    expect(tree).toContain('node_modules/ (skipped)')
    const hits = await runTool('search_code', { project: 'Shop', query: 'BONJOUR' })
    expect(hits).toMatch(/src[\\/]app\.ts:1:/)
    expect(hits).not.toContain('node_modules')
    expect(await runTool('search_code', { project: 'Shop', query: 'hunter2' })).toBe('No match.')
  })

  it('declares a fixed, cache-friendly tool list with eager input streaming', () => {
    expect(TOOLS.map(t => t.name)).toEqual(['list_projects', 'list_files', 'read_file', 'search_code', 'git_status', 'git_diff', 'docker_status', 'container_logs', 'db_connections', 'db_schema', 'n8n_workflows', 'n8n_executions', 'vercel_deployments', 'vps_health', 'vps_services', 'backups_status', 'github_status', 'automations_feed', 'symfony_entities', 'symfony_entity_draft'])
    expect(TOOLS.every(t => (t as { eager_input_streaming?: boolean }).eager_input_streaming)).toBe(true)
  })
})

describe('assistant config', () => {
  it('stores the API key encrypted and never returns it', () => {
    expect(getConfig()).toEqual({ hasKey: false, model: 'auto', effort: 'auto', monthlyBudget: 5, desktopWidget: false, actionMode: 'ask' })
    const c = saveConfig({ apiKey: ' sk-ant-secret ', model: 'claude-sonnet-5-5', effort: 'high', monthlyBudget: 12.345 })
    expect(c).toEqual({ hasKey: true, model: 'claude-sonnet-5-5', effort: 'high', monthlyBudget: 12.35, desktopWidget: false, actionMode: 'ask' })
    expect(saveConfig({ monthlyBudget: -3 }).monthlyBudget).toBe(12.35)
    expect(readFileSync(join(userData(), 'assistant', 'config.json'), 'utf-8')).not.toContain('sk-ant-secret')
    expect(getApiKey()).toBe('sk-ant-secret')
    expect(saveConfig({ model: 'gpt-4' as never }).model).toBe('claude-sonnet-5-5')
    expect(saveConfig({ clearKey: true }).hasKey).toBe(false)
    expect(getApiKey()).toBeNull()
  })

  it('keeps the desktop widget off unless turned on', () => {
    expect(saveConfig({ desktopWidget: 'yes' as never }).desktopWidget).toBe(false)
    expect(saveConfig({ desktopWidget: true }).desktopWidget).toBe(true)
    expect(saveConfig({ model: 'auto' }).desktopWidget).toBe(true)
    expect(saveConfig({ desktopWidget: false }).desktopWidget).toBe(false)
    // Approval mode: only the two known values are kept
    expect(saveConfig({ actionMode: 'whatever' as never }).actionMode).toBe('ask')
    expect(saveConfig({ actionMode: 'auto-safe' }).actionMode).toBe('auto-safe')
  })
})

describe('official AI tools', () => {
  it('lists the known tools and refuses anything else', async () => {
    const { listAiTools, launchAiTool } = await import('../../src/main/services/system/aiTools')
    const tools = await listAiTools()
    expect(tools.map(t => t.id)).toEqual(['claude-code', 'codex', 'antigravity', 'gemini-cli'])
    expect(tools.every(t => typeof t.installed === 'boolean' && t.installUrl.startsWith('https://'))).toBe(true)
    await expect(launchAiTool('calc.exe', null)).rejects.toThrow(/Unknown tool/)
    // Not installed: refused before anything starts
    const missing = tools.find(t => !t.installed)
    if (missing) await expect(launchAiTool(missing.id, null)).rejects.toThrow(/not installed/)
    // Installed: only saved project folders (checked before any terminal opens)
    const installed = tools.find(t => t.installed)
    if (installed) {
      saveProjects([])
      await expect(launchAiTool(installed.id, tempDir('not-a-project'))).rejects.toThrow(/Not a saved project/)
      await expect(launchAiTool(installed.id, 'C:/x & calc')).rejects.toThrow()
    }
  })
})
