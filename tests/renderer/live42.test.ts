import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DataTopic } from '@shared/types'

/** v4.2: the data kept between pages — one request for many pages, shown at once, read again when the main process says it changed */

let emit: (e: { topic: DataTopic; scope?: string }) => void = () => {}
vi.stubGlobal('window', { devforge: { onDataChanged: (cb: typeof emit) => { emit = cb; return () => {} } } })

let live: typeof import('@renderer/lib/live')
beforeAll(async () => { live = await import('@renderer/lib/live') })

/** A load that counts its calls and answers when told */
function loader<T>(values: T[]) {
  const calls = { n: 0 }
  const load = vi.fn(async () => { const v = values[Math.min(calls.n, values.length - 1)]; calls.n++; if (v instanceof Error) throw v; return v })
  return { load, calls }
}
const settle = () => new Promise(r => setTimeout(r, 0))

describe('kept data', () => {
  it('makes one request for two pages showing it at once, and tells both', async () => {
    const { load, calls } = loader([['a', 'b']])
    const heard = [0, 0]
    const stopA = live.watchLive('k1', load, () => heard[0]++)
    const stopB = live.watchLive('k1', load, () => heard[1]++)
    await settle()
    expect(calls.n).toBe(1)
    expect(live.liveSnapshot('k1')).toEqual({ data: ['a', 'b'], error: undefined, loaded: true })
    expect(heard).toEqual([1, 1])
    stopA(); stopB()
  })

  it('shows what it kept at once when a page comes back, without asking again while fresh', async () => {
    const { load, calls } = loader([1, 2])
    live.watchLive('k2', load, () => {})()
    await settle()
    const stop = live.watchLive('k2', load, () => {})
    expect(live.liveSnapshot('k2').data).toBe(1)
    await settle()
    expect(calls.n).toBe(1)
    stop()
  })

  it('reads again what is shown when its topic changes, for its project only, however the path is written', async () => {
    const shown = loader([['m1'], ['m1', 'm2']])
    const other = loader([['x'], ['x', 'y']])
    const stop = live.watchLive('models:a', shown.load, () => {}, { topic: 'models', scope: 'C:\\Projets\\Atelier' })
    const stopOther = live.watchLive('models:b', other.load, () => {}, { topic: 'models', scope: 'C:\\Projets\\Autre' })
    await settle()
    emit({ topic: 'models', scope: 'c:/projets/atelier/' })
    await settle()
    expect(live.liveSnapshot('models:a').data).toEqual(['m1', 'm2'])
    expect(other.calls.n).toBe(1)
    // Another topic: nothing read
    emit({ topic: 'projects' })
    await settle()
    expect(shown.calls.n).toBe(2)
    stop(); stopOther()
  })

  it('marks what is not shown, and reads it on its next showing', async () => {
    const { load, calls } = loader([['p1'], ['p1', 'p2']])
    live.watchLive('projects', load, () => {}, { topic: 'projects' })()
    await settle()
    emit({ topic: 'projects' })
    await settle()
    expect(calls.n).toBe(1)
    const stop = live.watchLive('projects', load, () => {}, { topic: 'projects' })
    expect(live.liveSnapshot('projects').data).toEqual(['p1'])
    await settle()
    expect(live.liveSnapshot('projects').data).toEqual(['p1', 'p2'])
    stop()
  })

  it('keeps the last good value when a read fails, with the error', async () => {
    const { load } = loader<unknown>(['ok', new Error('down')])
    const stop = live.watchLive('k3', load, () => {})
    await settle()
    await live.reloadLive('k3')
    expect(live.liveSnapshot('k3')).toMatchObject({ data: 'ok', loaded: true })
    expect((live.liveSnapshot('k3').error as Error).message).toBe('down')
    stop()
  })

  it('shows a change made here at once; refreshLive reads a whole topic again', async () => {
    const { load, calls } = loader([['c1'], ['c1', 'c2']])
    let heard = 0
    const stop = live.watchLive('db', load, () => heard++, { topic: 'db-connections' })
    await settle()
    live.setLive<string[]>('db', list => [...(list ?? []), 'local'])
    expect(live.liveSnapshot('db').data).toEqual(['c1', 'local'])
    expect(heard).toBe(2)
    live.refreshLive('db-connections')
    await settle()
    expect(calls.n).toBe(2)
    expect(live.liveSnapshot('db').data).toEqual(['c1', 'c2'])
    stop()
  })

  it('follows several topics, and keeps a slow read fresh for as long as it says', async () => {
    const { load, calls } = loader([['o1'], ['o2'], ['o3']])
    const stop = live.watchLive('overview', load, () => {}, { topic: ['ssh', 'db-connections'], freshMs: 60_000 })
    await settle()
    emit({ topic: 'ssh' })
    await settle()
    emit({ topic: 'db-connections' })
    await settle()
    expect(calls.n).toBe(3)
    stop()
    // Shown again within its minute: kept as it is, not read
    live.watchLive('overview', load, () => {})()
    await settle()
    expect(calls.n).toBe(3)
    expect(live.liveSnapshot('overview').data).toEqual(['o3'])
  })

  it('keeps a change made here over an answer asked before it (the next read brings what was written)', async () => {
    let answer: (v: string[]) => void = () => {}
    const load = vi.fn(() => new Promise<string[]>(r => { answer = r }))
    const stop = live.watchLive('settings-like', load, () => {}, { topic: 'settings' })
    answer(['disk'])
    await settle()
    // A read on its way, then a change here: the old answer does not undo it
    emit({ topic: 'settings' })
    live.setLive<string[]>('settings-like', () => ['mine'])
    answer(['old'])
    await settle()
    expect(live.liveSnapshot('settings-like').data).toEqual(['mine'])
    // The change written, its own read shows it
    emit({ topic: 'settings' })
    answer(['mine'])
    await settle()
    expect(live.liveSnapshot('settings-like').data).toEqual(['mine'])
    expect(load).toHaveBeenCalledTimes(3)
    stop()
  })

  it('reads again after the read on its way when a change is told meanwhile (its answer may be older)', async () => {
    const answers: ((v: string[]) => void)[] = []
    const load = vi.fn(() => new Promise<string[]>(r => { answers.push(r) }))
    const stop = live.watchLive('lists', load, () => {}, { topic: 'models' })
    // The first read is on its way when a model is written
    emit({ topic: 'models' })
    expect(load).toHaveBeenCalledTimes(1)
    answers[0]([])
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    answers[1](['new.sequence.json'])
    await settle()
    expect(live.liveSnapshot('lists').data).toEqual(['new.sequence.json'])
    stop()
  })

  it('compares project paths whatever their slashes and case', () => {
    expect(live.samePath('C:\\A\\b\\', 'c:/a/B')).toBe(true)
    expect(live.samePath('C:\\A\\b', 'C:\\A\\bc')).toBe(false)
  })
})
