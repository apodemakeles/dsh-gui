/**
 * Host half of dsh-gui: after the web surface tree has mounted, this plugin
 * starts an IPC fetch carrier (HTTP over a Unix socket, no TCP port) and
 * launches the Electron shell that loads the official web client.
 */
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { toFetchHandler, type ApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { listenFetchOnUnixSocket } from './assembly/unix-http.ts'
import { dispatchExactWebRoute, type ExactRouteSource } from './assembly/web-route-dispatch.ts'
import { resolveWebClientDist } from './assembly/web-client-dist.ts'
import { applyTokenUsage } from './features/token-usage/host/index.ts'
import type { ClientModuleFace, IndexRenderer } from './host/session-files.ts'
import { writeShellSession } from './host/session-files.ts'
import { resolveShellPaths } from './host/shell-paths.ts'
import { spawnElectronShell } from './host/spawn-shell.ts'

type FetchFace = { fetch(request: Request): Promise<Response> }

type GuiContext = Context & {
  apiProxy: ApiProxy
  webServer: IndexRenderer & ExactRouteSource
  clientModules: ClientModuleFace
  connection: {
    createSharedFetchHandler(channel: '/api', fallback: FetchFace): FetchFace
  }
}

export const name = 'dsh-gui'

export const inject = [
  'apiProxy',
  'clientModules',
  'webServer',
  'connection',
  // token-usage feature: live session store + the persistence seam.
  'sessions',
  'sessionPersistence',
]

export function apply(ctx: GuiContext): void {
  // Feature modules register synchronously, so their exact routes (the
  // token-usage snapshot) are in the webServer table before the carrier
  // starts dispatching below.
  applyTokenUsage(ctx)

  const dist = resolveWebClientDist(import.meta.url)
  const paths = resolveShellPaths(import.meta.url)
  const rawIndex = readFileSync(dist.distIndex, 'utf8')

  const started = writeShellSession({
    dist,
    rawIndex,
    webServer: ctx.webServer,
    clientModules: ctx.clientModules,
  }).then(async (files) => {
    // Typert remotes (pluginInventory/list, …) ride connection's /api
    // interceptor. Unary session RPC and SSE downlinks (events.mux / events.host)
    // stay on toFetchHandler — connection's HTTP route answers those GETs with
    // 426 because the browser carrier uses WebSocket, which this shell does not.
    // Feature exact routes (official precedence: exact beats the /api prefix)
    // dispatch first through the webServer's table.
    const handler = ctx.connection.createSharedFetchHandler(
      '/api',
      toFetchHandler(ctx.apiProxy),
    )
    const server = await listenFetchOnUnixSocket(files.socketPath, async (request) => {
      const routed = await dispatchExactWebRoute(ctx.webServer, request)
      return routed ?? handler.fetch(request)
    })
    const shell = spawnElectronShell(paths, files.sessionPath)
    let hostDisposed = false
    const stop = () => {
      shell.stop()
      server.close()
      void rm(files.dir, { recursive: true, force: true })
    }
    shell.child.once('exit', (code) => {
      stop()
      if (hostDisposed) return
      process.exit(code ?? 0)
    })
    return {
      stop: () => {
        hostDisposed = true
        stop()
      },
      files,
    }
  })

  void started.catch((error: unknown) => {
    console.error('dsh-gui: failed to start the shell', error)
    process.exit(1)
  })

  ctx.effect(
    () => () => {
      void started.then((runtime) => runtime.stop())
    },
    'dsh-gui: shell',
  )
}
