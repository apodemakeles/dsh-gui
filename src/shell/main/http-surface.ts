/**
 * Loopback HTTP surface for the client window.
 *
 * Since dsh 0.1.5 the remote-event mux dials `ws://<page-origin>/api/remote.mux`,
 * and Electron strips ports from custom-scheme URLs — so a `dsh-gui://` origin
 * can never carry the port a `ws:` derivation needs. The client therefore loads
 * from `http://127.0.0.1:<ephemeral>` and this server is the whole surface:
 *
 * - `/api` requests and WebSocket upgrades pipe straight through to the host's
 *   Unix HTTP server (the gateway's mux route owns the upgraded socket), so
 *   auth, streaming, and the trust fence see the official localhost shape;
 * - dist assets, the assembled index, and plugin client bundles are served
 *   exactly as the custom protocol served them (same assembly helpers).
 *
 * Loopback-only, ephemeral port — the same exposure as `dsh --profile web`
 * on 127.0.0.1 (see ADR 0001 amendment).
 */
import { readFile } from 'node:fs/promises'
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { Duplex } from 'node:stream'
import { mimeForFile } from '../../assembly/mime.ts'
import {
  combinePluginBundleSources,
  isShellIndexPath,
  resolveDistFile,
  resolvePluginAsset,
  resolvePluginCombo,
} from '../../assembly/static-path.ts'
import type { ShellSession } from '../../assembly/session.ts'

export interface HttpSurface {
  port: number
  close(): void
}

export function startHttpSurface(session: ShellSession): Promise<HttpSurface> {
  const bundles = new Map(Object.entries(session.pluginBundles))
  const server: Server = createServer((req, res) => {
    void dispatch(req, res)
  })
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname.startsWith('/api')) {
      proxyUpgrade(req, socket as unknown as Duplex, head)
      return
    }
    socket.destroy()
  })

  const sockets = new Set<Duplex>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)

    // `/api` and the document root both live on the host: the root runs
    // Connection's browser-auth (launch token → cookie → index), so it must
    // be proxied with its query string intact.
    if (
      pathname === '/' ||
      isShellIndexPath(pathname) ||
      pathname === '/api' ||
      pathname.startsWith('/api/')
    ) {
      proxyApi(req, res)
      return
    }

    const pluginPath = resolvePluginAsset(pathname, bundles)
    if (pluginPath !== undefined) {
      await fileResponse(res, pluginPath)
      return
    }
    // The boot graph addresses plugin bundles through the combo route
    // (/plugins/??<id>/client.js,…&rev=…) even for a single entry.
    if (url.pathname === '/plugins/' && url.search.startsWith('??')) {
      const comboPaths = resolvePluginCombo(url.search, bundles)
      if (comboPaths !== undefined) {
        try {
          const sources: string[] = []
          for (const path of comboPaths) sources.push(await readFile(path, 'utf8'))
          res.writeHead(200, { 'content-type': mimeForFile('client.js') })
          res.end(combinePluginBundleSources(sources))
          return
        } catch {
          res.writeHead(404)
          res.end('not found')
          return
        }
      }
      res.writeHead(404)
      res.end('not found')
      return
    }

    const distFile = resolveDistFile(pathname, session.distRoot)
    if (distFile === undefined) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    await fileResponse(res, distFile)
  }

  function proxyApi(req: IncomingMessage, res: ServerResponse): void {
    const upstream = httpRequest(
      {
        socketPath: session.socketPath,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end()
    })
    req.pipe(upstream)
  }

  function proxyUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const upstream = httpRequest({
      socketPath: session.socketPath,
      path: req.url,
      headers: req.headers,
    })
    upstream.on('upgrade', (upRes, upSocket, upHead) => {
      const lines = [`HTTP/1.1 ${String(upRes.statusCode)} ${upRes.statusMessage ?? ''}`]
      for (let index = 0; index < upRes.rawHeaders.length; index += 2) {
        lines.push(`${String(upRes.rawHeaders[index])}: ${String(upRes.rawHeaders[index + 1])}`)
      }
      socket.write(lines.join('\r\n') + '\r\n\r\n')
      if (upHead.length > 0) socket.write(upHead)
      upSocket.setNoDelay(true)
      upSocket.setTimeout(0)
      upSocket.pipe(socket)
      socket.pipe(upSocket)
      const kill = (): void => {
        socket.destroy()
        upSocket.destroy()
      }
      socket.on('error', kill)
      upSocket.on('error', kill)
      socket.on('close', kill)
      upSocket.on('close', kill)
    })
    upstream.on('error', () => socket.destroy())
    upstream.end()
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({
        port,
        close: (): void => {
          server.close()
          for (const socket of sockets) socket.destroy()
        },
      })
    })
  })
}

async function fileResponse(
  res: ServerResponse,
  filePath: string,
  contentTypeOverride?: string,
): Promise<void> {
  try {
    const body = await readFile(filePath)
    res.writeHead(200, {
      'content-type': contentTypeOverride ?? mimeForFile(filePath),
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}
