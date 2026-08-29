import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, protocol, shell } from 'electron'
import {
  parseShellSession,
  SESSION_ENV,
  type ShellSession,
} from '../../assembly/session.ts'
import { INDEX_URL, SHELL_SCHEME, APP_NAME } from '../shared/scheme.ts'
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

function denyWindowOpen(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createPlaceholderWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    title: APP_NAME,
  })
  denyWindowOpen(win)
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function createClientWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: false,
      sandbox: false,
      nodeIntegration: false,
    },
  })
  denyWindowOpen(win)
  void win.loadURL(INDEX_URL)
  return win
}

function quitShell(): void {
  app.exit(0)
}

void app.whenReady().then(() => {
  const session = sessionFromEnv()
  if (session === undefined) {
    createPlaceholderWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPlaceholderWindow()
    })
    return
  }
  installShellProtocol(session)
  // Unpackaged `Electron.app` otherwise occupies the Dock as a generic
  // "Electron" tile (and macOS recent-apps may keep it after quit).
  app.dock?.hide()
  const win = createClientWindow()
  win.on('closed', () => {
    quitShell()
  })
})

app.on('window-all-closed', () => {
  quitShell()
})
