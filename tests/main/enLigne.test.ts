import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tempDir } from '../helpers'

// No server here: any SSH call would fail the test
vi.mock('../../src/main/services/ssh/sshService', () => ({
  sshService: {
    connectForDashboard: async () => { throw new Error('no SSH in this test') },
    disconnect: () => {},
    exec: async () => { throw new Error('no SSH in this test') },
    forwardOut: async () => { throw new Error('no SSH in this test') }
  }
}))

const { triggerOf } = await import('../../src/main/services/n8n/n8nService')
const { testApi, testOutput } = await import('../../src/main/services/vps/testOutputs')

describe('n8n workflow trigger', () => {
  it('reads what starts a workflow from its first trigger node', () => {
    expect(triggerOf([{ name: 'Set', type: 'n8n-nodes-base.set' }, { name: 'Webhook boutique', type: 'n8n-nodes-base.webhook' }])).toEqual({ kind: 'webhook', name: 'Webhook boutique' })
    expect(triggerOf([{ name: 'Chaque jour', type: 'n8n-nodes-base.scheduleTrigger' }])?.kind).toBe('schedule')
    expect(triggerOf([{ name: 'Cron', type: 'n8n-nodes-base.cron' }])?.kind).toBe('schedule')
    expect(triggerOf([{ name: 'Manuel', type: 'n8n-nodes-base.manualTrigger' }])?.kind).toBe('manual')
    expect(triggerOf([{ name: 'Erreur', type: 'n8n-nodes-base.errorTrigger' }])?.kind).toBe('error')
    expect(triggerOf([{ name: 'Gmail Trigger', type: 'n8n-nodes-base.gmailTrigger' }])).toEqual({ kind: 'other', name: 'Gmail Trigger' })
  })

  it('has none for a workflow started by another, and copes with odd nodes', () => {
    expect(triggerOf([{ name: 'Execute Workflow', type: 'n8n-nodes-base.executeWorkflow' }])).toBeNull()
    expect(triggerOf(undefined)).toBeNull()
    expect(triggerOf([{ name: 'x' }, {} as never])).toBeNull()
    expect(triggerOf([{ name: 'n'.repeat(300), type: 'n8n-nodes-base.webhook' }])?.name).toHaveLength(80)
  })
})

describe('canned answers of the e2e tests', () => {
  afterEach(() => { delete process.env.DEVFORGE_TEST_VPS })

  it('answers an API call by its method and path, the query left out', () => {
    const file = join(tempDir(), 'vps.json')
    writeFileSync(file, JSON.stringify({ n8nStatus: 'yes', n8nApi: { 'GET /workflows': { data: [] } }, vpnApi: { 'GET /client': [] } }))
    process.env.DEVFORGE_TEST_VPS = file
    expect(testOutput('n8nStatus')).toBe('yes')
    expect(testApi('n8nApi', 'GET', '/workflows?limit=250')).toEqual({ data: [] })
    expect(testApi('vpnApi', 'GET', '/client')).toEqual([])
    expect(testApi('vpnApi', 'POST', '/client')).toBeUndefined()
    expect(testOutput('vpnDetect')).toBeNull()
  })

  it('answers nothing without the variable', () => {
    expect(testOutput('n8nStatus')).toBeNull()
    expect(testApi('n8nApi', 'GET', '/workflows')).toBeUndefined()
  })
})
