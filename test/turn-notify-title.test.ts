import { describe, expect, it } from 'vitest'
import { titleOfSession } from '../src/features/turn-notify/host/title.ts'

describe('titleOfSession', () => {
  it('prefers the log-backed title snapshot', () => {
    const session = { id: 'abc', header: { cwd: '/tmp/demo' } }
    expect(titleOfSession(session, { title: '重构通知模块', eventSeq: 1 })).toBe('重构通知模块')
  })

  it('falls back to the cwd basename', () => {
    const session = { id: 'abc', header: { cwd: '/Users/dev/my project' } }
    expect(titleOfSession(session, undefined)).toBe('my project')
    expect(titleOfSession({ id: 'abc', header: { cwd: 'C:\\repo\\win' } }, undefined)).toBe('win')
  })

  it('falls back to the session id, then a placeholder', () => {
    expect(titleOfSession({ id: 'abc', header: {} }, undefined)).toBe('abc')
    expect(titleOfSession({}, undefined)).toBe('未命名会话')
  })

  it('ignores blank titles and non-string shapes', () => {
    const session = { id: 'abc', header: { cwd: '/tmp/demo' } }
    expect(titleOfSession(session, { title: '   ' })).toBe('demo')
    expect(titleOfSession(session, { title: 42 })).toBe('demo')
  })
})
