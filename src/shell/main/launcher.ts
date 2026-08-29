/**
 * Launcher mode for the packaged .app: this process is both the shell and the
 * parent. It spawns `dsh --profile gui` with the external-shell handshake
 * directory, shows a splash while the host boots (plugin loading takes tens of
 * seconds), then swaps in the real client window. Closing any window
 * terminates the host before the app exits.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import net from 'node:net'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import {
  EXTERNAL_SHELL_DIR_ENV,
  parseShellSession,
  type ShellSession,
} from '../../assembly/session.ts'
import {
  dshSearchPaths,
  HOST_SOCKET,
  locateDshBinary,
  SESSION_FILE,
} from '../../assembly/launch.ts'
import { installShellProtocol } from './protocol.ts'
import { createClientWindow } from './client-window.ts'
import { APP_NAME } from '../shared/scheme.ts'

/** Cold plugin loading measures ~30–40s; leave 3× headroom before failing. */
const HOST_BOOT_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 250
const HOST_TERM_TIMEOUT_MS = 5_000
const HOST_KILL_TIMEOUT_MS = 3_000

export interface LauncherHandle {
  focusMain(): void
  shutdown(): Promise<void>
}

export function startLauncher(): LauncherHandle {
  const userData = app.getPath('userData')
  const runDir = join(userData, 'run')
  const logPath = join(userData, 'logs', 'host.log')

  let state: 'booting' | 'ready' | 'failed' = 'booting'
  let host: ChildProcess | undefined
  let splash: BrowserWindow | undefined
  let client: BrowserWindow | undefined
  let logFd: number | undefined
  let splashDismissed = false
  let shuttingDown = false
  let shutdownPromise: Promise<void> | undefined

  const fail = (message: string): void => {
    if (shuttingDown) return
    state = 'failed'
    const page = statusHtml({ phase: 'error', error: message, logPath })
    if (client !== undefined && !client.isDestroyed()) {
      void client.loadURL(page)
    } else if (splash !== undefined && !splash.isDestroyed()) {
      void splash.loadURL(page)
    }
  }

  const onHostDied = (code: number | null, signal: NodeJS.Signals | null): void => {
    const how = signal !== null ? `signal ${signal}` : `code ${code ?? '?'}`
    if (state === 'booting') {
      fail(`dsh host exited during startup (${how})`)
    } else if (state === 'ready') {
      fail(`dsh host exited unexpectedly (${how})`)
    }
  }

  const shutdown = (): Promise<void> => {
    if (shutdownPromise !== undefined) return shutdownPromise
    shuttingDown = true
    shutdownPromise = (async () => {
      if (host !== undefined && host.exitCode === null) {
        const termExited = waitExit(host, HOST_TERM_TIMEOUT_MS)
        host.kill('SIGTERM')
        if (!(await termExited)) {
          const killExited = waitExit(host, HOST_KILL_TIMEOUT_MS)
          host.kill('SIGKILL')
          await killExited
        }
      }
      if (logFd !== undefined) {
        try {
          closeSync(logFd)
        } catch {
          // already closed
        }
      }
      app.exit(0)
    })()
    return shutdownPromise
  }

  const boot = async (): Promise<void> => {
    const dshBin = locateDshBinary(dshSearchPaths(process.env, homedir()))
    if (dshBin === undefined) {
      splash = createStatusWindow()
      splash.on('closed', () => {
        void shutdown()
      })
      fail(
        'dsh CLI not found. Install dsh, or point DSH_GUI_DSH_BIN at the binary ' +
          '(e.g. `launchctl setenv DSH_GUI_DSH_BIN /path/to/dsh`).',
      )
      return
    }

    rmSync(runDir, { recursive: true, force: true })
    mkdirSync(runDir, { recursive: true })
    mkdirSync(dirname(logPath), { recursive: true })
    logFd = openSync(logPath, 'a')
    appendFileSync(
      logFd,
      `\n===== ${new Date().toISOString()} ${dshBin} --profile gui =====\n`,
    )

    splash = createStatusWindow()
    splash.on('closed', () => {
      if (!splashDismissed) void shutdown()
    })
    void splash.loadURL(statusHtml({ phase: 'starting' }))

    // A Finder-launched app has a minimal PATH; the host (node/dsh) expects
    // the usual prefixes for tools it may spawn.
    const PATH = [
      ...new Set(
        (process.env['PATH'] ?? '').split(':').concat([
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
        ]),
      ),
    ]
      .filter((part) => part !== '')
      .join(':')

    host = spawn(dshBin, ['--profile', 'gui'], {
      env: {
        ...process.env,
        PATH,
        [EXTERNAL_SHELL_DIR_ENV]: runDir,
      },
      stdio: ['ignore', logFd, logFd],
    })
    host.once('exit', (code, signal) => {
      if (!shuttingDown) onHostDied(code, signal)
    })

    let session: ShellSession
    try {
      session = await pollForHandshake(runDir, Date.now() + HOST_BOOT_TIMEOUT_MS)
    } catch (error) {
      if (!shuttingDown) {
        host.kill('SIGTERM')
        fail(error instanceof Error ? error.message : String(error))
      }
      return
    }
    if (shuttingDown) return

    state = 'ready'
    installShellProtocol(session)
    client = createClientWindow()
    client.on('closed', () => {
      void shutdown()
    })
    splashDismissed = true
    splash?.destroy()
  }

  void boot()

  return {
    focusMain(): void {
      const win = client ?? splash
      if (win === undefined || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.focus()
    },
    shutdown,
  }
}

/** Poll the run directory until the host publishes a session with a live
 *  socket. session.json is written atomically (tmp + rename) by the host, so
 *  a successful parse means the payload is complete. */
async function pollForHandshake(runDir: string, deadline: number): Promise<ShellSession> {
  const sessionPath = join(runDir, SESSION_FILE)
  for (;;) {
    if (existsSync(sessionPath)) {
      try {
        const session = parseShellSession(readFileSync(sessionPath, 'utf8'))
        if (await probeSocket(session.socketPath)) return session
      } catch {
        // not complete yet (or socket not listening) — keep polling
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `host did not become ready within ${Math.round(HOST_BOOT_TIMEOUT_MS / 1000)}s ` +
          `(no live ${SESSION_FILE} + ${HOST_SOCKET} in ${runDir})`,
      )
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

function probeSocket(socketPath: string, timeoutMs = 1_500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ path: socketPath })
    const done = (ok: boolean): void => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    setTimeout(() => done(false), timeoutMs).unref()
  })
}

function waitExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true)
      return
    }
    const onExit = (): void => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createStatusWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 460,
    height: 300,
    resizable: false,
    title: APP_NAME,
    useContentSize: true,
  })
  return win
}

type StatusState =
  | { phase: 'starting' }
  | { phase: 'error'; error: string; logPath?: string }

function statusHtml(state: StatusState): string {
  const body =
    state.phase === 'starting'
      ? `<div class="spinner" aria-hidden="true"></div>
         <p class="lead">正在启动 dsh 宿主…</p>
         <p class="sub">Starting the dsh host — first loads can take a minute.</p>`
      : `<p class="x" aria-hidden="true">✕</p>
         <p class="lead">启动失败</p>
         <p class="sub">Startup failed</p>
         <p class="msg">${escapeHtml(state.error)}</p>
         ${state.logPath !== undefined ? `<p class="log">host log:<br><code>${escapeHtml(state.logPath)}</code></p>` : ''}`
  return (
    'data:text/html;charset=utf-8,' +
    encodeURIComponent(`<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${APP_NAME}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; background: #0e1116; color: #d7dde5;
    font-family: -apple-system, "PingFang SC", system-ui, sans-serif; padding: 0 32px;
    text-align: center; box-sizing: border-box;
  }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid #2a3240; border-top-color: #4da3ff;
    animation: spin 0.9s linear infinite; margin-bottom: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .lead { font-size: 15px; font-weight: 600; margin: 0; }
  .sub { font-size: 12px; color: #8b95a3; margin: 0; }
  .x { font-size: 30px; color: #e5484d; margin: 0 0 4px; }
  .msg { font-size: 12px; color: #c3ccd8; margin: 8px 0 0; max-width: 380px;
         overflow-wrap: anywhere; }
  .log { font-size: 11px; color: #8b95a3; margin: 10px 0 0; }
  .log code { font-family: ui-monospace, Menlo, monospace; color: #aeb9c6; }
</style>
</head>
<body>${body}</body>
</html>`)
  )
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
