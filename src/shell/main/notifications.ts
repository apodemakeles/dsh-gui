// Shell-side turn-completion notifications (spec.md §3.2).
//
// Polls the host's long-poll endpoint over the existing Unix carrier, gates
// on foreground state, and raises the macOS Notification. Click focuses the
// window and forwards the session id to the page world (the client half opens
// the session). No TCP port: fetchOverUnixSocket is the same transport the
// main process already uses for the fetch carrier.
//
// Focus gate (spec.md §2.3): the app-level active signal is unreliable while
// app.dock is hidden, so this tracks the client window's focus/blur events
// and combines the cache with a live isFocused() snapshot. The first macOS
// notification also triggers the system's one-time permission prompt —
// expected behavior for an unsigned .app (research ticket 03).

import type { BrowserWindow } from 'electron'
import { Notification } from 'electron'
import type { ShellSession } from '../../assembly/session.ts'
import { fetchOverUnixSocket } from '../../assembly/unix-http.ts'
import { TURN_NOTIFY_EVENTS_PATH, passesFocusGate } from '../../features/turn-notify/shared/protocol.ts'
import type { TurnNotifyEvent } from '../../features/turn-notify/shared/protocol.ts'

const POLL_WAIT_SECONDS = 25
const RETRY_DELAY_MS = 5_000

export interface TurnNotifyHandle {
  stop(): void
}

export function startTurnNotify(session: ShellSession, win: BrowserWindow): TurnNotifyHandle {
  let stopped = false
  let recentlyFocused = false

  const onFocus = (): void => {
    recentlyFocused = true
  }
  const onBlur = (): void => {
    recentlyFocused = false
  }
  win.on('focus', onFocus)
  win.on('blur', onBlur)

  const show = (event: TurnNotifyEvent): void => {
    const focused = !win.isDestroyed() && win.isFocused()
    if (!passesFocusGate({ focused, recentlyFocused })) return
    const notification = new Notification({
      title: event.title,
      body: event.outcome === 'ok' ? '处理完成' : '处理失败',
    })
    notification.on('click', () => {
      if (win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send('dsh-gui:open-session', event.sessionId)
    })
    notification.show()
  }

  const query = normalizeQuery(session.authToken)
  const base = `http://127.0.0.1${TURN_NOTIFY_EVENTS_PATH}${query}`

  void (async () => {
    let warnedForbidden = false
    while (!stopped) {
      try {
        const url = new URL(`${base}${query === '' ? '?' : '&'}wait=${POLL_WAIT_SECONDS}`)
        const response = await fetchOverUnixSocket(session.socketPath, url)
        if (response.status === 403) {
          if (!warnedForbidden) {
            warnedForbidden = true
            console.error('turn-notify: poll rejected (auth token mismatch); retrying with backoff')
          }
          await sleep(RETRY_DELAY_MS)
          continue
        }
        if (!response.ok) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        const payload = (await response.json()) as { events?: TurnNotifyEvent[] }
        for (const event of payload.events ?? []) show(event)
      } catch (error) {
        if (!stopped) console.error('turn-notify: poll failed; retrying', error)
        await sleep(RETRY_DELAY_MS)
      }
    }
  })()

  return {
    stop(): void {
      stopped = true
      win.off('focus', onFocus)
      win.off('blur', onBlur)
    },
  }
}

/** The launch-token query as written by the host (`?token=…`, possibly empty). */
function normalizeQuery(authToken: string): string {
  if (authToken === '') return ''
  return authToken.startsWith('?') ? authToken : `?${authToken}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
