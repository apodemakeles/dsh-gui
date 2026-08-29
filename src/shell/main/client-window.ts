// BrowserWindow factory shared by the host-spawned mode and the launcher:
// one client window over dsh-gui://index.html, external links to the browser.

import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { INDEX_URL, APP_NAME } from '../shared/scheme.ts'

export function denyWindowOpen(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

export function createClientWindow(): BrowserWindow {
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
