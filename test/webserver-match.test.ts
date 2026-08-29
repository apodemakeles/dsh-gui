import { describe, expect, it } from 'vitest'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { matchWebRoute } from '../src/host/webserver.ts'

const handler: WebRoute['handler'] = () => undefined

describe('matchWebRoute', () => {
  it('prefers an exact path over a prefix', () => {
    const exact = new Map<string, WebRoute>([
      ['/api', { kind: 'exact', path: '/api', handler }],
    ])
    const prefixes = new Map<string, WebRoute>([
      ['/api', { kind: 'prefix', path: '/api', handler }],
    ])
    expect(matchWebRoute('/api', exact, prefixes)?.kind).toBe('exact')
  })

  it('matches /api/pluginInventory/list to the /api prefix', () => {
    const prefixes = new Map<string, WebRoute>([
      ['/api', { kind: 'prefix', path: '/api', handler }],
    ])
    expect(matchWebRoute('/api/pluginInventory/list', new Map(), prefixes)?.path).toBe(
      '/api',
    )
  })

  it('returns undefined when nothing matches', () => {
    expect(matchWebRoute('/static/x', new Map(), new Map())).toBeUndefined()
  })
})
