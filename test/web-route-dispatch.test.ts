// Fetch→node adapter for exact webServer routes: header merge precedence,
// status/body capture, miss passthrough, and handler failure containment.
import { describe, expect, it } from 'vitest'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { dispatchExactWebRoute } from '../src/assembly/web-route-dispatch.ts'

function table(...routes: WebRoute[]) {
  const map = new Map(routes.map((route) => [route.path, route]))
  return { exactRoutes: () => map }
}

function get(path: string): Request {
  return new Request(`dsh-gui://local${path}`)
}

describe('dispatchExactWebRoute', () => {
  it('returns undefined when no exact route matches', async () => {
    const source = table()
    await expect(dispatchExactWebRoute(source, get('/api/none'))).resolves.toBeUndefined()
  })

  it('adapts a node-style handler: status, body, and writeHead-over-setHeader headers', async () => {
    const source = table({
      kind: 'exact',
      path: '/api/token-dashboard/snapshot',
      handler: (req, res) => {
        // The request-like carries url (with query), method, and headers.
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-set', 'implicit')
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'overridden' })
        res.end(JSON.stringify({ weeks: query.get('weeks') }))
      },
    })
    const response = await dispatchExactWebRoute(source, get('/api/token-dashboard/snapshot?weeks=26'))
    expect(response).toBeDefined()
    expect(response!.status).toBe(200)
    expect(response!.headers.get('cache-control')).toBe('overridden')
    expect(response!.headers.get('x-set')).toBe('implicit')
    await expect(response!.json()).resolves.toEqual({ weeks: '26' })
  })

  it('keeps implicit headers when writeHead carries none', async () => {
    const source = table({
      kind: 'exact',
      path: '/x',
      handler: (_req, res) => {
        res.setHeader('content-type', 'text/plain')
        res.writeHead(201)
        res.write('chunked-')
        res.end('tail')
      },
    })
    const response = await dispatchExactWebRoute(source, get('/x'))
    expect(response!.status).toBe(201)
    expect(response!.headers.get('content-type')).toBe('text/plain')
    await expect(response!.text()).resolves.toBe('chunked-tail')
  })

  it('turns a throwing handler into a contained 500', async () => {
    const source = table({
      kind: 'exact',
      path: '/boom',
      handler: () => {
        throw new Error('boom')
      },
    })
    const response = await dispatchExactWebRoute(source, get('/boom'))
    expect(response!.status).toBe(500)
  })
})
