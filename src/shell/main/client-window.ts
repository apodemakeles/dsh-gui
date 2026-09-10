// BrowserWindow factory shared by the host-spawned mode and the launcher:
// one client window over dsh-gui://index.html, external links to the browser.

import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { clientUrlFor, APP_NAME } from '../shared/scheme.ts'

export function denyWindowOpen(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

/** `surfacePort` — the loopback HTTP surface port; the page origin must
 * carry it so the gateway's `ws://` remote-event mux dials the surface.
 * `authToken` rides the first navigation to mint the browser-auth cookie. */
export function createClientWindow(surfacePort: number, authToken: string): BrowserWindow {
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
  void win.loadURL(clientUrlFor(surfacePort, authToken))
  return win
}
