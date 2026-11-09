import { describe, expect, it } from 'vitest'
import { describeCall } from '../../src/renderer/src/features/webhooks/describeCall'

describe('webhook calls', () => {
  it('names a Stripe event by its type', () => {
    expect(describeCall({ url: '/webhooks/stripe', headers: { 'stripe-signature': 't=1,v1=x', 'user-agent': 'Stripe/1.0' }, body: '{"type":"payment_intent.succeeded"}' }))
      .toEqual({ name: 'payment_intent.succeeded', source: 'Stripe' })
  })

  it('names a GitHub event with its repository', () => {
    expect(describeCall({ url: '/gh', headers: { 'x-github-event': 'push', 'user-agent': 'GitHub-Hookshot/abc' }, body: '{"repository":{"name":"boutique-en-ligne"}}' }))
      .toEqual({ name: 'push · boutique-en-ligne', source: 'GitHub' })
  })

  it('reads a type or an event in any JSON, else keeps the path', () => {
    expect(describeCall({ url: '/hook', headers: { 'user-agent': 'n8n/1.82' }, body: '{"event":"order.created"}' })).toEqual({ name: 'order.created', source: 'n8n' })
    expect(describeCall({ url: '/hook?x=1', headers: {}, body: 'plain text' })).toEqual({ name: '/hook?x=1', source: null })
    expect(describeCall({ url: '', headers: {}, body: '[1,2]' }).name).toBe('/')
  })

  it('keeps a long or odd value short and safe', () => {
    expect(describeCall({ url: '/', headers: {}, body: JSON.stringify({ type: 'x'.repeat(300) }) }).name).toHaveLength(80)
    expect(describeCall({ url: '/p', headers: {}, body: '{"type":{"nested":true}}' }).name).toBe('/p')
  })
})
