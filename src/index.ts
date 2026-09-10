/**
 * Host half of dsh-gui: after the web surface tree has mounted, this plugin
 * starts an IPC fetch carrier (HTTP over a Unix socket, no TCP port) and
 * launches the Electron shell that loads the official web client. In launcher
 * mode (packaged .app spawned us via DSH_GUI_EXTERNAL_SHELL_DIR) the shell is
 * already running: only the carrier and the handshake are set up here.
 */
import { readFileSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import { listenFetchOnUnixSocket } from './assembly/unix-http.ts'
import {
  callNodeStyleHandler,
  dispatchExactWebRoute,
  type ExactRouteSource,
} from './assembly/web-route-dispatch.ts'
import { isShellIndexPath } from './assembly/static-path.ts'
import { HTML_MIME } from './assembly/mime.ts'
import { resolveWebClientDist } from './assembly/web-client-dist.ts'
import { EXTERNAL_SHELL_DIR_ENV } from './assembly/session.ts'
import { applyTokenUsage } from './features/token-usage/host/index.ts'
import type { ClientModuleFace, IndexRenderer } from './host/session-files.ts'
import { writeShellSession } from './host/session-files.ts'
import { resolveShellPaths } from './host/shell-paths.ts'
import { spawnElectronShell } from './host/spawn-shell.ts'

type FetchFace = { fetch(request: Request): Promise<Response> }

type UpgradeRouteSource = {
  upgradeRoutes(): ReadonlyMap<string, WebUpgradeRoute>
}

type GuiContext = Context & {
  webServer: IndexRenderer & ExactRouteSource & UpgradeRouteSource
  clientModules: ClientModuleFace
  connection: {
    createSharedFetchHandler(channel: '/api'): FetchFace
    /** Browser-auth: mint the cookie from the launch token, gate the index. */
    authorizeIndex(request: unknown, response: unknown): boolean
    authenticatedUrl(baseUrl: string): string
  }
}

export const name = 'dsh-gui'

export const inject = [
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
  // Launcher mode (packaged .app): the shell is already running and spawned
  // this host, so skip our own Electron and publish the handshake where the
  // launcher told us to.
  const externalDir = process.env[EXTERNAL_SHELL_DIR_ENV]

  const dist = resolveWebClientDist(import.meta.url)
  const rawIndex = readFileSync(dist.distIndex, 'utf8')

  // The browser-auth plane (dsh 0.1.5): the shell's first navigation carries
  // this launch token; authorizeIndex mints the cookie that /api and the
  // remote-event WebSocket require.
  const authToken = new URL(ctx.connection.authenticatedUrl('http://127.0.0.1/')).search

  const started = writeShellSession({
    dist,
    rawIndex,
    webServer: ctx.webServer,
    clientModules: ctx.clientModules,
    authToken,
    dirOverride: externalDir,
  }).then(async (files) => {
    // Since dsh 0.1.5, Connection composes the shared /api RPC handler itself;
    // createSharedFetchHandler no longer takes a fetch fallback. Feature exact
    // routes (the token-usage snapshot) still live on the webServer's table and
    // dispatch first — official precedence: exact beats the /api channel.
    // Index requests run through Connection's browser-auth: a launch token
    // mints the cookie (303), a valid cookie earns the assembled index, and
    // the remote-event WebSocket upgrade dispatches to the gateway's mux.
    const rpc = ctx.connection.createSharedFetchHandler('/api')
    const server = await listenFetchOnUnixSocket(files.socketPath, async (request) => {
      const url = new URL(request.url)
      if (url.pathname === '/' || isShellIndexPath(url.pathname)) {
        let authorized = false
        const authResponse = await callNodeStyleHandler((req, res) => {
          authorized = ctx.connection.authorizeIndex(req, res)
        }, request)
        if (authorized) {
          return new Response(await readFile(files.indexPath), {
            status: 200,
            headers: { 'content-type': HTML_MIME },
          })
        }
        return authResponse
      }
      const routed = await dispatchExactWebRoute(ctx.webServer, request)
      return routed ?? rpc.fetch(request)
    }, (req, socket, head) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      const route = ctx.webServer.upgradeRoutes().get(pathname)
      if (route === undefined) {
        socket.destroy()
        return
      }
      void route.handler(req, socket, head)
    })
    let hostDisposed = false
    const stop = () => {
      server.close()
      // A private mkdtemp is ours to remove wholesale; a launcher-provided
      // directory is not — only the handshake files we created.
      if (externalDir === undefined || externalDir === '') {
        void rm(files.dir, { recursive: true, force: true })
      } else {
        for (const file of [files.sessionPath, files.socketPath, files.indexPath]) {
          void rm(file, { force: true })
        }
      }
    }
    if (externalDir === undefined || externalDir === '') {
      const shell = spawnElectronShell(resolveShellPaths(import.meta.url), files.sessionPath)
      shell.child.once('exit', (code) => {
        stop()
        if (hostDisposed) return
        process.exit(code ?? 0)
      })
    } else {
      // Orphan guard: if the launcher .app dies without stopping us (force
      // quit), we get reparented to pid 1 — exit instead of lingering as a
      // headless host holding the profile.
      const guard = setInterval(() => {
        if (process.ppid === 1) process.exit(0)
      }, 5_000)
      guard.unref()
    }
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
