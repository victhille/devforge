import { describe, expect, it } from 'vitest'
import { ciChanges, latestByWorkflow } from '../../src/shared/lib/ciAlerts'

/** v3.8 lot 2: the CI watch's reading of the runs */
const run = (name: string, conclusion: string | null, status = 'completed', branch = 'main') => ({ name, conclusion, status, branch })

describe('v3.8 lot 2: GitHub CI alerts', () => {
  it('takes each workflow\'s last finished run, cancelled ones saying nothing', () => {
    expect(latestByWorkflow([
      run('CI', null, 'in_progress'), run('CI', 'cancelled'), run('CI', 'failure', 'completed', 'feat/x'), run('CI', 'success'),
      run('Site', 'success'), run('Release', 'timed_out'), run('Lint', 'skipped')
    ])).toEqual({ CI: { outcome: 'failure', branch: 'feat/x' }, Site: { outcome: 'success', branch: 'main' }, Release: { outcome: 'failure', branch: 'main' } })
  })

  it('rings on green to red and red to green only, never for a workflow seen the first time', () => {
    expect(ciChanges(undefined, { CI: 'failure' })).toEqual({ failed: [], fixed: [] })
    expect(ciChanges({ CI: 'success', Site: 'success' }, { CI: 'failure', Site: 'success' })).toEqual({ failed: ['CI'], fixed: [] })
    expect(ciChanges({ CI: 'failure' }, { CI: 'failure' })).toEqual({ failed: [], fixed: [] })
    expect(ciChanges({ CI: 'failure' }, { CI: 'success' })).toEqual({ failed: [], fixed: ['CI'] })
  })
})
