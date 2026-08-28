import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'

describe('plugin shape', () => {
  it('exports a cordis-style plugin (name + apply)', () => {
    expect(plugin.name).toBe('dsh-gui')
    expect(typeof plugin.apply).toBe('function')
  })
})
