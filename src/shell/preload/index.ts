/**
 * Page-world preload — intentionally minimal since dsh 0.1.5.
 *
 * The 0.1.x contract had the preload install `__DSH_TRANSPORT__` with an
 * AbstractApiClient subclass. The 0.1.5 frontend dropped that seam: its boot
 * only reads an optional `loadBundle` hook, and every request rides same-origin
 * fetch, which the dsh-gui:// protocol carries over the Unix socket without
 * page-world help.
 *
 * turn-notify adds the one seam the page still cannot reach: main → renderer
 * events. `contextIsolation: false` means this assignment lands directly in
 * the page world, where the turn-notify client half consumes it to jump to a
 * session after a notification click.
 */
import { ipcRenderer } from 'electron'

declare global {
  interface Window {
    __DSH_NOTIFY__?: {
      /** Subscribe to notification-click session opens; returns the disposer. */
      onOpenSession(callback: (sessionId: string) => void): () => void
    }
  }
}

window.__DSH_NOTIFY__ = {
  onOpenSession(callback: (sessionId: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, sessionId: string): void => {
      callback(sessionId)
    }
    ipcRenderer.on('dsh-gui:open-session', listener)
    return () => {
      ipcRenderer.removeListener('dsh-gui:open-session', listener)
    }
  },
}

export {}
