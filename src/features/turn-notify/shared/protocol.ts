/**
 * turn-notify feature — shared protocol between the halves.
 *
 * The host half decides WHICH turn completions deserve a notification (and
 * names them); the Electron shell owns the macOS Notification surface; the
 * client half owns the settings card and the click-to-open-session jump.
 * Everything here is pure and browser-safe: the client bundle may import it.
 */

/** How a turn's end maps onto the notification copy. */
export type TurnNotifyOutcome = 'ok' | 'fail'

/** Settings namespace (host section + client card key) and locale namespace. */
export const TURN_NOTIFY_NS = 'turn-notify'

/** Long-poll endpoint on the webServer exact-route table. */
export const TURN_NOTIFY_EVENTS_PATH = '/api/turn-notify/events'

/** One pending notification, delivered host → shell over the poll endpoint. */
export interface TurnNotifyEvent {
  sessionId: string
  title: string
  outcome: TurnNotifyOutcome
}

/**
 * Verdict for one `turn/end` reason kind. `silent` covers the user's own
 * cancellations and the kinds the spec rules out (spec.md §2.1); unknown
 * future kinds default to silent — vocabulary growth must not spam users.
 */
export type TurnNotifyDecision = TurnNotifyOutcome | 'silent'

/**
 * spec.md §2.1: completed/max-tokens/blocked → 处理完成, error → 处理失败,
 * everything else (aborted/interrupted/unknown) stays silent.
 */
export function decideTurnEnd(reasonKind: string | undefined): TurnNotifyDecision {
  switch (reasonKind) {
    case 'completed':
    case 'max-tokens':
    case 'blocked':
      return 'ok'
    case 'error':
      return 'fail'
    default:
      return 'silent'
  }
}

export interface FocusSnapshot {
  /** Live `win.isFocused()` at decision time (destroyed window → false). */
  focused: boolean
  /** Focus/blur cache — true when the window held focus after its last event. */
  recentlyFocused: boolean
}

/**
 * spec.md §2.3: notify only when the shell is not the frontmost app. The
 * app-level active signal is unreliable in dock-hidden mode, so this is a
 * window-level gate: the live snapshot and the event cache must both say
 * "no focus".
 */
export function passesFocusGate(snapshot: FocusSnapshot): boolean {
  return !snapshot.focused && !snapshot.recentlyFocused
}
