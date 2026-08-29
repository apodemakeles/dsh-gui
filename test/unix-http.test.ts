import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { fetchOverUnixSocket, listenFetchOnUnixSocket } from '../src/assembly/unix-http.ts'

const sockets: string[] = []
const servers: import('node:http').Server[] = []

afterEach(async () => {
  for (const server of servers) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  servers.length = 0
  sockets.length = 0
})

function socketPath(): string {
  const path = join(tmpdir(), `dsh-gui-unix-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sock`)
  sockets.push(path)
  return path
}

describe('unix-socket fetch', () => {
  it('round-trips a JSON unary POST', async () => {
    const path = socketPath()
    const server = await listenFetchOnUnixSocket(path, async (request) => {
      expect(request.method).toBe('POST')
      expect(new URL(request.url).pathname).toBe('/api/session.list')
      expect(request.headers.get('content-type')).toBe('application/json')
      const body: unknown = await request.json()
      expect(body).toEqual({ rpcId: '1', method: 'session.list' })
      return Response.json({ type: 'server-response', rpcId: '1' })
    })
    servers.push(server)

    const response = await fetchOverUnixSocket(
      path,
      'http://dsh.internal/api/session.list',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rpcId: '1', method: 'session.list' }),
      },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ type: 'server-response', rpcId: '1' })
  })

  it('streams a body the caller can read incrementally', async () => {
    const path = socketPath()
    const server = await listenFetchOnUnixSocket(path, async () => {
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: one\n\n'))
          controller.enqueue(encoder.encode('data: two\n\n'))
          controller.close()
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    })
    servers.push(server)

    const response = await fetchOverUnixSocket(path, 'http://dsh.internal/api/events.mux')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('data: one\n\ndata: two\n\n')
  })

  it('forwards the URL hostname as Host and drops sec-fetch-site', async () => {
    const path = socketPath()
    const server = await listenFetchOnUnixSocket(path, async (request) => {
      expect(request.headers.get('host')).toBe('127.0.0.1')
      expect(request.headers.get('sec-fetch-site')).toBeNull()
      return new Response('ok')
    })
    servers.push(server)

    const response = await fetchOverUnixSocket(path, 'http://127.0.0.1/api/pluginInventory/list', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
      body: '{}',
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })
})

describe('listenFetchOnUnixSocket isolation', () => {
  it('does not bind a TCP port', async () => {
    const path = socketPath()
    const server = await listenFetchOnUnixSocket(path, async () => new Response('ok'))
    servers.push(server)
    const address = server.address()
    expect(typeof address).toBe('string')
    expect(address).toMatch(/\.sock$/)
  })
})
