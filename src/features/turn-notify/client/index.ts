// turn-notify feature — browser half.
//
// Two contributions (spec.md §3.4):
// - the settings card under `settings.plugin.item`, keyed by the host-side
//   settings namespace — the official Plugins tab pairs them; the card draws
//   only its row (05 票: no custom card chrome).
// - the notification-click bridge: the preload-installed `__DSH_NOTIFY__`
//   hands over the clicked session id; `ctx.sessions.open` jumps to it.

import type { ClientContext } from '../../../client/client-context.ts'
import { TURN_NOTIFY_NS } from '../shared/protocol.ts'
import { createTurnNotifyCardEntry, type TurnNotifyConfig } from './SettingsCard.tsx'
import { injectStyles } from './styles.ts'
import { LOCALE_NS, en, zh } from './locales.ts'

interface NotifyBridge {
  onOpenSession(callback: (sessionId: string) => void): () => void
}

/** Mount the settings card and the click-to-open-session receiver. */
export function applyTurnNotifyClient(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'turn-notify: dictionaries')

  ctx.effect(
    () => {
      injectStyles()
      return () => {
        document.getElementById('dsh-turn-notify-styles')?.remove()
      }
    },
    'turn-notify: stylesheet',
  )

  if (ctx.settingsScope !== undefined) {
    ctx.slots.inject('settings.plugin.item', () => {
      let disposeEntry: (() => void) | undefined
      try {
        const scope = ctx.settingsScope!.bind<TurnNotifyConfig>({ namespace: TURN_NOTIFY_NS })
        disposeEntry = ctx.slots.register(
          { name: 'settings.plugin.item', id: 'turn-notify', key: TURN_NOTIFY_NS, locale: LOCALE_NS },
          createTurnNotifyCardEntry(scope),
        )
      } catch (error) {
        console.error('turn-notify: settings card registration failed', error)
      }
      return () => {
        disposeEntry?.()
      }
    })
  } else {
    console.warn('turn-notify: settingsScope unavailable; settings card not mounted')
  }

  ctx.effect(() => {
    const bridge = (globalThis as { __DSH_NOTIFY__?: NotifyBridge }).__DSH_NOTIFY__
    if (bridge === undefined) return
    return bridge.onOpenSession((sessionId) => {
      if (sessionId === '') return
      try {
        ctx.sessions?.open(sessionId)
      } catch (error) {
        console.error('turn-notify: open session failed', error)
      }
    })
  }, 'turn-notify: open-session bridge')
}
