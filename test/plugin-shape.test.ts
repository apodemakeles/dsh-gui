// Plugin shape contract: the single bundle entry (host) plus its composed
// client half, and the token-usage worker entry.
import { describe, expect, it } from 'vitest'
import * as host from '../src/index.ts'
import * as client from '../src/client/index.ts'
import { UsageWorker } from '../src/features/token-usage/host/usage-worker.ts'

describe('dual-face plugin shape', () => {
  it('host half declares the shell + token-usage services and exports apply', () => {
    expect(host.name).toBe('dsh-gui')
    expect(host.inject).toEqual([
      'apiProxy',
      'clientModules',
      'webServer',
      'connection',
      'sessions',
      'sessionPersistence',
    ])
    expect(typeof host.apply).toBe('function')
  })

  it('client half declares slots + locale and exports apply', () => {
    expect(client.inject).toEqual(['slots', 'locale'])
    expect(typeof client.apply).toBe('function')
  })

  it('durable worker entry exports the command loop', () => {
    expect(typeof UsageWorker).toBe('function')
  })
})
