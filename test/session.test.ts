import { describe, expect, it } from 'vitest'
import { parseShellSession } from '../src/assembly/session.ts'

describe('parseShellSession', () => {
  it('accepts a complete payload', () => {
    const session = parseShellSession(
      JSON.stringify({
        socketPath: '/tmp/dsh-gui.sock',
        distRoot: '/dist',
        indexPath: '/tmp/index.html',
        pluginBundles: { '@deepseek-ai/dsh-client-modules': '/pkg/client.js' },
      }),
    )
    expect(session.socketPath).toBe('/tmp/dsh-gui.sock')
    expect(session.pluginBundles['@deepseek-ai/dsh-client-modules']).toBe(
      '/pkg/client.js',
    )
  })

  it('rejects a payload missing required fields', () => {
    expect(() => parseShellSession('{"socketPath":"/tmp/x"}')).toThrow(
      /missing required string fields/,
    )
  })

  it('rejects a pluginBundles map whose values are not paths', () => {
    expect(() =>
      parseShellSession(
        JSON.stringify({
          socketPath: '/tmp/dsh-gui.sock',
          distRoot: '/dist',
          indexPath: '/tmp/index.html',
          pluginBundles: { '@deepseek-ai/dsh-client-modules': 1 },
        }),
      ),
    ).toThrow(/missing required string fields/)
  })
})
