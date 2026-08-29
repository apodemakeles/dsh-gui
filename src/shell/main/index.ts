import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, protocol } from 'electron'
import {
  parseShellSession,
  SESSION_ENV,
  type ShellSession,
} from '../../assembly/session.ts'
import { SHELL_SCHEME, APP_NAME } from '../shared/scheme.ts'
import { createClientWindow } from './client-window.ts'
import { startLauncher } from './launcher.ts'
import { installShellProtocol } from './protocol.ts'

app.setName(APP_NAME)
app.setPath('userData', join(app.getPath('appData'), APP_NAME))

protocol.registerSchemesAsPrivileged([
  {
    scheme: SHELL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

function sessionFromEnv(): ShellSession | undefined {
  const path = process.env[SESSION_ENV]
  if (path === undefined || path === '') return undefined
  return parseShellSession(readFileSync(path, 'utf8'))
}

function createPlaceholderWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    title: APP_NAME,
  })
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function quitShell(): void {
  app.exit(0)
}

void app.whenReady().then(() => {
  // Host-spawned mode (terminal `dsh --profile gui`): the plugin wrote the
  // session file and passed it via env. Closing the window exits; the host
  // watches this process and exits with it.
  const session = sessionFromEnv()
  if (session !== undefined) {
    installShellProtocol(session)
    // Unpackaged `Electron.app` otherwise occupies the Dock as a generic
    // "Electron" tile (and macOS recent-apps may keep it after quit).
    app.dock?.hide()
    const win = createClientWindow()
    win.on('closed', () => {
      quitShell()
    })
    app.on('window-all-closed', () => {
      quitShell()
    })
    return
  }

  // Launcher mode (packaged .app double-clicked): spawn the host ourselves,
  // show a splash, and terminate the host on exit. The dock icon is this
  // app's own identity.
  if (app.isPackaged) {
    if (!app.requestSingleInstanceLock()) {
      app.exit(0)
      return
    }
    const launcher = startLauncher()
    app.on('second-instance', () => {
      launcher.focusMain()
    })
    app.on('window-all-closed', () => {
      void launcher.shutdown()
    })
    return
  }

  // Development placeholder (pnpm dev, no host session).
  createPlaceholderWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPlaceholderWindow()
  })
  app.on('window-all-closed', () => {
    quitShell()
  })
})
