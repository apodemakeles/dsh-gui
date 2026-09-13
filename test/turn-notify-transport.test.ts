// Integration: the full host-side transport of turn-notify, over a REAL Unix
// socket and the REAL exact-route dispatch. This is the layer the unit tests
// (queue/decide/title) deliberately skip: applyTurnNotify's route must hold a
// buffered dispatchExactWebRoute response until an event arrives (the
// long-poll contract spec.md §3.1 depends on), and the token guard must
// refuse requests that do not carry the launch-token query.
//
// Each test gets its own mkdtemp socket: the HTTP agent pools keep-alive
// connections per socket path, so re-listening on one shared path would leak
// requests to the previous test's server.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { dispatchExactWebRoute, type ExactRouteSource } from '../src/assembly/web-route-dispatch.ts'
import { fetchOverUnixSocket, listenFetchOnUnixSocket } from '../src/assembly/unix-http.ts'
import { applyTurnNotify } from '../src/features/turn-notify/host/index.ts'
import type { TurnNotifyEvent } from '../src/features/turn-notify/shared/protocol.ts'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

const AUTH_TOKEN = '?token=e2e-token'

/** Minimal cordis Context fake: synchronous effect + capturable listener. */
function fakeContext(): {
  ctx: Context
  fireTurnEnd: (session: unknown, event: unknown) => void
} {
  let turnEndListener: ((session: unknown, event: unknown) => void) | undefined
  const ctx = {
    effect: (task: () => unknown) => {
      task()
      return () => undefined
    },
    on: (_event: string, listener: (session: unknown, event: unknown) => void) => {
      turnEndListener = listener
      return () => undefined
    },
  } as unknown as Context
  return {
    ctx,
    fireTurnEnd: (session, event) => turnEndListener?.(session, event),
  }
}

/** webServer face with the real register shape + real dispatch source. */
class FakeWebServer implements ExactRouteSource {
  private readonly routes = new Map<string, WebRoute>()
  register(route: { kind: 'exact'; path: string; handler: WebRoute['handler'] }): () => void {
    this.routes.set(route.path, route as WebRoute)
    return () => {
      this.routes.delete(route.path)
    }
  }
  exactRoutes(): ReadonlyMap<string, WebRoute> {
    return this.routes
  }
}

describe('turn-notify transport (real socket + real dispatch)', () => {
  let dir = ''
  let socketPath = ''
  let closeServer: (() => void) | undefined

  afterEach(async () => {
    closeServer?.()
    closeServer = undefined
    if (dir !== '') await rm(dir, { recursive: true, force: true })
    dir = ''
    socketPath = ''
  })

  async function start(features?: { sessionTitle?: unknown }): Promise<{
    fireTurnEnd: (session: unknown, event: unknown) => void
  }> {
    dir = await mkdtemp(join(tmpdir(), 'turn-notify-e2e-'))
    socketPath = join(dir, 'test.sock')
    const { ctx, fireTurnEnd } = fakeContext()
    if (features?.sessionTitle !== undefined) {
      ;(ctx as unknown as { sessionTitle: unknown }).sessionTitle = features.sessionTitle
    }
    const webServer = new FakeWebServer()
    ;(ctx as unknown as { webServer: unknown }).webServer = webServer
    applyTurnNotify(ctx, { authToken: AUTH_TOKEN })
    const server = await listenFetchOnUnixSocket(socketPath, async (request) => {
      const routed = await dispatchExactWebRoute(webServer, request)
      return routed ?? new Response('not found', { status: 404 })
    })
    closeServer = () => {
      server.close()
    }
    return { fireTurnEnd }
  }

  const poll = (search: string, waitSeconds = 0): Promise<Response> =>
    fetchOverUnixSocket(socketPath, new URL(`http://127.0.0.1/api/turn-notify/events${search}`))

  it('refuses requests without the launch-token query', async () => {
    await start()
    const response = await poll('?token=wrong')
    expect(response.status).toBe(403)
  })

  it('holds the response until an event arrives, then delivers it', async () => {
    const { fireTurnEnd } = await start({ sessionTitle: { get: () => ({ title: '标题甲' }) } })
    const pending = poll(`${AUTH_TOKEN}&wait=5`)
    fireTurnEnd(
      { id: 'sess-1', header: {} },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    )
    const response = await pending
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { events: TurnNotifyEvent[] }
    expect(payload.events).toEqual([{ sessionId: 'sess-1', title: '标题甲', outcome: 'ok' }])
  })

  it('answers an empty wait with an empty event list', async () => {
    await start()
    const response = await poll(`${AUTH_TOKEN}&wait=1`)
    expect(response.status).toBe(200)
    expect((await response.json()) as { events: unknown[] }).toEqual({ ok: true, events: [] })
  })

  it('keeps aborted turns and subagent sessions silent', async () => {
    const { fireTurnEnd } = await start({ sessionTitle: { get: () => ({ title: '标题乙' }) } })
    fireTurnEnd(
      { id: 'sess-2', header: {} },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'aborted', reason: 'user' } } },
    )
    fireTurnEnd(
      { id: 'sess-3', header: { origin: 'subagent' } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    )
    const response = await poll(`${AUTH_TOKEN}&wait=0`)
    expect((await response.json()) as { events: unknown[] }).toEqual({ ok: true, events: [] })
  })

  it('maps error turns to the fail outcome with the cwd-basename fallback title', async () => {
    const { fireTurnEnd } = await start()
    fireTurnEnd(
      { id: 'sess-4', header: { cwd: '/Users/dev/demo-project' } },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'error', error: { message: 'boom', code: 'X' } } } },
    )
    const response = await poll(`${AUTH_TOKEN}&wait=0`)
    const payload = (await response.json()) as { events: TurnNotifyEvent[] }
    expect(payload.events).toEqual([
      { sessionId: 'sess-4', title: 'demo-project', outcome: 'fail' },
    ])
  })
})
