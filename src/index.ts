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
import { resolveWebClientDist } from './assembly/web-client-dist.ts'
import type { ClientModuleFace, IndexRenderer } from './host/session-files.ts'
import { writeShellSession } from './host/session-files.ts'
import { resolveShellPaths } from './host/shell-paths.ts'
import { spawnElectronShell } from './host/spawn-shell.ts'

type FetchFace = { fetch(request: Request): Promise<Response> }

type GuiContext = Context & {
  apiProxy: ApiProxy
  webServer: IndexRenderer
  clientModules: ClientModuleFace
  connection: {
    createSharedFetchHandler(channel: '/api', fallback: FetchFace): FetchFace
  }
}

export const name = 'dsh-gui'

export const inject = ['apiProxy', 'clientModules', 'webServer', 'connection']

export function apply(ctx: GuiContext): void {
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
    const handler = ctx.connection.createSharedFetchHandler(
      '/api',
      toFetchHandler(ctx.apiProxy),
    )
    const server = await listenFetchOnUnixSocket(files.socketPath, (request) =>
      handler.fetch(request),
    )
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
