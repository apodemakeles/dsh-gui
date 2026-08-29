/**
 * Fetch-shaped HTTP over a Unix domain socket.
 * The host listens; the Electron main process is the client. No TCP port.
 */
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
  type ClientRequest,
  request as httpRequest,
} from 'node:http'
import { Readable, type Writable } from 'node:stream'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'

const INTERNAL_ORIGIN = 'http://127.0.0.1'

export type FetchHandler = (request: Request) => Promise<Response>

async function bindUnixServer(
  socketPath: string,
  onRequest: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<Server> {
  if (existsSync(socketPath)) await unlink(socketPath)
  const server = createServer(onRequest)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ path: socketPath }, () => {
      server.off('error', reject)
      resolve()
    })
  })
  return server
}

/**
 * Serve a WHATWG fetch handler on `socketPath`. Replaces a stale socket file.
 * The returned server is already listening.
 */
export async function listenFetchOnUnixSocket(
  socketPath: string,
  fetchImpl: FetchHandler,
): Promise<Server> {
  return bindUnixServer(socketPath, (req, res) => {
    void dispatch(req, res, fetchImpl)
  })
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  fetchImpl: FetchHandler,
): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', INTERNAL_ORIGIN)
  const headers = flattenHeaders(req.headers)
  const body =
    chunks.length > 0 && method !== 'GET' && method !== 'HEAD'
      ? Buffer.concat(chunks)
      : undefined
  const request = new Request(url, {
    method,
    headers,
    signal: abort.signal,
    ...(body === undefined ? {} : { body, duplex: 'half' }),
  } as RequestInit)
  let response: Response
  try {
    response = await fetchImpl(request)
  } catch (error) {
    if (abort.signal.aborted) return
    res.writeHead(500)
    res.end(error instanceof Error ? error.message : String(error))
    return
  }
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (response.body === null || method === 'HEAD') {
    res.end()
    return
  }
  await pipeWebBody(response.body, res)
}

function copyNodeHeaders(
  headers: IncomingMessage['headers'],
  set: (key: string, value: string) => void,
): void {
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') set(key, value)
    else if (Array.isArray(value)) set(key, value.join(', '))
  }
}

function flattenHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  copyNodeHeaders(headers, (key, value) => {
    out[key] = value
  })
  return out
}

async function pipeWebBody(
  webBody: ReadableStream<Uint8Array>,
  dest: Writable,
): Promise<void> {
  const nodeBody = Readable.fromWeb(webBody as import('node:stream/web').ReadableStream)
  await new Promise<void>((resolve, reject) => {
    nodeBody.on('error', reject)
    nodeBody.on('end', resolve)
    nodeBody.pipe(dest)
  })
}

/**
 * Call the host fetch handler through the Unix socket, returning a streaming Response.
 */
export function fetchOverUnixSocket(
  socketPath: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  const signal = request.signal
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error('This operation was aborted'))
  }
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'sec-fetch-site') return
      headers[key] = value
    })
    headers.host = url.hostname === '' ? '127.0.0.1' : url.hostname
    const req = httpRequest(
      {
        socketPath,
        path: `${url.pathname}${url.search}`,
        method: request.method,
        headers,
      },
      (incoming) => {
        const status = incoming.statusCode ?? 500
        const responseHeaders = new Headers()
        copyNodeHeaders(incoming.headers, (key, value) => {
          responseHeaders.set(key, value)
        })
        const noBody =
          request.method === 'HEAD' || status === 204 || status === 304
        const body = noBody
          ? null
          : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>)
        resolve(new Response(body, { status, headers: responseHeaders }))
      },
    )
    req.on('error', reject)
    const onAbort = () => {
      req.destroy(abortError(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    req.on('close', () => signal.removeEventListener('abort', onAbort))
    void writeRequestBody(req, request).catch((error: unknown) => {
      req.destroy()
      reject(error)
    })
  })
}

async function writeRequestBody(req: ClientRequest, request: Request): Promise<void> {
  if (request.body === null) {
    req.end()
    return
  }
  await pipeWebBody(request.body, req)
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason
  if (typeof signal.reason === 'string') return new Error(signal.reason)
  return new Error('This operation was aborted')
}
