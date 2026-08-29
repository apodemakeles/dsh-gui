import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'

describe('plugin shape', () => {
  it('exports a cordis-style plugin (name + apply)', () => {
    expect(plugin.name).toBe('dsh-gui')
    expect(typeof plugin.apply).toBe('function')
  })

  it('waits for the web-surface services the shell forwards over IPC', () => {
    expect(plugin.inject).toEqual(['apiProxy', 'clientModules', 'webServer', 'connection'])
  })
})
