import { describe, expect, it } from 'vitest'
import { decideTurnEnd, passesFocusGate } from '../src/features/turn-notify/shared/protocol.ts'

describe('decideTurnEnd', () => {
  it('maps successful ends to the ok copy', () => {
    expect(decideTurnEnd('completed')).toBe('ok')
    expect(decideTurnEnd('max-tokens')).toBe('ok')
    expect(decideTurnEnd('blocked')).toBe('ok')
  })

  it('maps failures to the fail copy', () => {
    expect(decideTurnEnd('error')).toBe('fail')
  })

  it('keeps the user own cancellations silent', () => {
    expect(decideTurnEnd('aborted')).toBe('silent')
    expect(decideTurnEnd('interrupted')).toBe('silent')
  })

  it('defaults unknown kinds to silent', () => {
    expect(decideTurnEnd('plugin-continuation')).toBe('silent')
    expect(decideTurnEnd(undefined)).toBe('silent')
  })
})

describe('passesFocusGate', () => {
  it('notifies only when neither the snapshot nor the cache sees focus', () => {
    expect(passesFocusGate({ focused: false, recentlyFocused: false })).toBe(true)
    expect(passesFocusGate({ focused: true, recentlyFocused: false })).toBe(false)
    expect(passesFocusGate({ focused: false, recentlyFocused: true })).toBe(false)
    expect(passesFocusGate({ focused: true, recentlyFocused: true })).toBe(false)
  })
})
