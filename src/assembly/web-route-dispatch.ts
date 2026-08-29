/**
 * Dispatch the webServer's exact-route table from the Unix fetch carrier.
 *
 * Feature modules register routes the official way (`ctx.webServer.register`
 * with a node-style `(req, res)` handler). The carrier speaks Fetch, so a hit
 * is adapted: a minimal request-like readable plus a response capture that
 * reproduces node's setHeader/writeHead merge semantics (writeHead wins on
 * name collisions). Only GET-style exact routes are promised; prefix/upgrade/
 * fallback seats stay silent — the `/api` channel is composed directly in
 * src/index.ts.
 */
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

/** Read-only view of the exact-route table the silent webServer maintains. */
export interface ExactRouteSource {
  exactRoutes(): ReadonlyMap<string, WebRoute>
}

/**
 * Run the exact route matching the request path, if any.
 * @returns the handler's Response, or undefined when no exact route matches.
 */
export async function dispatchExactWebRoute(
  source: ExactRouteSource,
  request: Request,
): Promise<Response | undefined> {
  const route = source.exactRoutes().get(new URL(request.url).pathname)
  if (route === undefined) return undefined
  return runNodeStyleHandler(route, request)
}

async function runNodeStyleHandler(route: WebRoute, request: Request): Promise<Response> {
  const capture = new ResponseCapture()
  const body =
    request.method === 'GET' || request.method === 'HEAD' || request.body === null
      ? Readable.from([])
      : Readable.fromWeb(request.body as never)
  const req = Object.assign(body, {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  }) as unknown as IncomingMessage
  try {
    await route.handler(req, capture.asServerResponse())
  } catch (error) {
    console.error(`dsh-gui: web route handler for "${route.path}" failed`, error)
    return new Response('internal error', { status: 500 })
  }
  return capture.toResponse()
}

/**
 * Captures node-style response writes into a Fetch Response. Effective
 * headers = setHeader values overridden by any writeHead(headers) entries.
 */
class ResponseCapture {
  private readonly implicit = new Map<string, string>()
  private readonly explicit = new Map<string, string>()
  private readonly written: Buffer[] = []
  private status = 200

  asServerResponse(): ServerResponse {
    return this as unknown as ServerResponse
  }

  statusCode = 200

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.implicit.set(name.toLowerCase(), String(value))
    return this
  }

  getHeader(name: string): string | undefined {
    const key = name.toLowerCase()
    return this.explicit.get(key) ?? this.implicit.get(key)
  }

  removeHeader(name: string): this {
    const key = name.toLowerCase()
    this.implicit.delete(key)
    this.explicit.delete(key)
    return this
  }

  writeHead(status: number, headers?: Record<string, string | number | readonly string[]>): this {
    this.status = status
    this.statusCode = status
    if (headers !== undefined) {
      for (const [name, value] of Object.entries(headers)) {
        this.explicit.set(name.toLowerCase(), String(value))
      }
    }
    return this
  }

  write(chunk: unknown): boolean {
    if (chunk !== undefined && chunk !== null) this.written.push(Buffer.from(chunk as never))
    return true
  }

  end(chunk?: unknown): this {
    if (chunk !== undefined && chunk !== null) this.written.push(Buffer.from(chunk as never))
    return this
  }

  flushHeaders(): void {}

  on(): this {
    return this
  }

  once(): this {
    return this
  }

  emit(): boolean {
    return false
  }

  toResponse(): Response {
    const headers = new Map(this.implicit)
    for (const [name, value] of this.explicit) headers.set(name, value)
    return new Response(Buffer.concat(this.written), {
      status: this.status,
      headers: [...headers].map(([name, value]) => [name, value] as [string, string]),
    })
  }
}
