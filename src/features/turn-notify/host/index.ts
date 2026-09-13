// turn-notify feature — host half.
//
// Decides WHICH turn completions deserve a notification (spec.md §2.1–2.2:
// outcome mapping, global switch, subagent filter) and names them; the shell
// owns the macOS Notification surface and the focus gate.
//
// Transport: a long-poll exact route on the webServer table (`GET
// /api/turn-notify/events`, token-usage snapshot registration shape). The
// exact-route dispatch is buffered (web-route-dispatch ResponseCapture), so
// instead of SSE the handler holds the response until an event arrives or the
// wait elapses — same socket, same precedence (exact beats /api), zero new
// listening surfaces. Requests must carry the launch-token query the session
// already hands to the shell, so a local process cannot read session-name
// traffic anonymously.
//
// The switch persists through the official settings namespace `turn-notify`
// (`settings.yaml` section, live reload via the section hooks); the client
// card writes through the same namespace (spec.md §3).

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Schema from '@deepseek-ai/schemastery'
import {
  TURN_NOTIFY_EVENTS_PATH,
  TURN_NOTIFY_NS,
  decideTurnEnd,
  type TurnNotifyEvent,
} from '../shared/protocol.ts'
import { TurnNotifyQueue } from './queue.ts'
import { titleOfSession } from './title.ts'

/** Long-poll hold ceiling; the shell re-polls in a loop, so this only bounds leaks. */
const MAX_WAIT_MS = 30_000
const DEFAULT_WAIT_MS = 25_000

/**
 * Structural faces this feature touches on the host context — read
 * defensively through one cast, since each face is optional at runtime (a
 * missing webServer/settings/sessionTitle degrades the feature, not the host).
 */
interface TurnNotifyFaces {
  webServer?: {
    register(route: {
      kind: 'exact'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  settings?: {
    installSection(
      owner: Context,
      ns: string,
      schema: unknown,
      entry: { enabled: boolean },
      hooks: {
        setSource(current: () => { enabled?: boolean }): void
        onChange(): void
      },
    ): void
  }
  sessionTitle?: {
    get(session: unknown): unknown
  }
}

export interface TurnNotifyOptions {
  /**
   * Connection's launch-token query (leading `?` included, as carried by the
   * session file). Poll requests must match it verbatim.
   */
  authToken: string
}

/** Mount the turn-completion notification pipeline. */
export function applyTurnNotify(ctx: Context, options: TurnNotifyOptions): void {
  const faces = ctx as unknown as TurnNotifyFaces
  ctx.effect(
    () => {
      const queue = new TurnNotifyQueue()
      let isEnabled = true
      let getSource: (() => { enabled?: boolean }) | undefined

      // Switch state — the settings section is the one source of truth; the
      // hooks keep this mirror hot so the event listener never touches IO.
      if (faces.settings !== undefined) {
        try {
          faces.settings.installSection(ctx, TURN_NOTIFY_NS, buildSchema(), { enabled: true }, {
            setSource: (current) => {
              getSource = current
              isEnabled = current()?.enabled ?? true
            },
            onChange: () => {
              isEnabled = getSource?.()?.enabled ?? true
            },
          })
        } catch (error) {
          console.error('turn-notify: settings registration failed; notifications stay on', error)
        }
      }

      const disposeListener = ctx.on('session/event', (session: unknown, event: unknown) => {
        const envelope = event as { type?: string; data?: { reason?: { kind?: string } } } | undefined
        if (envelope?.type !== 'turn/end') return
        const decision = decideTurnEnd(envelope.data?.reason?.kind)
        if (decision === 'silent') return
        if (!isEnabled) return
        const header = (session as { header?: { origin?: unknown } } | null | undefined)?.header
        if (header?.origin === 'subagent') return
        queue.push({
          sessionId: sessionIdOf(session),
          title: titleOfSession(session, faces.sessionTitle?.get(session)),
          outcome: decision,
        })
      })

      const disposeRoute = faces.webServer?.register({
        kind: 'exact',
        path: TURN_NOTIFY_EVENTS_PATH,
        handler: async (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost')
          if (options.authToken !== '' && !carriesAuthToken(url, options.authToken)) {
            res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
            res.end('{"ok":false}')
            return
          }
          const waitMs = waitMsOf(url.searchParams.get('wait'))
          const events = await queue.poll(waitMs)
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify({ ok: true, events }))
        },
      })

      if (disposeRoute === undefined) {
        console.error('turn-notify: webServer unavailable; the shell will never see events')
      }

      return () => {
        disposeListener()
        disposeRoute?.()
        queue.clear()
      }
    },
    'turn-notify: turn completion notifications',
  )
}

function buildSchema(): unknown {
  return Schema.object({
    enabled: Schema.boolean()
      .description('对话处理完成后，若 dsh-gui 不在前台则弹 macOS 通知')
      .default(true),
  }).description('轮次完成通知')
}

/**
 * Every (key, value) pair of the launch-token query must be present on the
 * request — callers may append more params (the shell adds `wait`), so an
 * exact search-string compare would reject every real poll.
 */
function carriesAuthToken(url: URL, authToken: string): boolean {
  const raw = authToken.startsWith('?') ? authToken : `?${authToken}`
  const expected = new URL(`http://localhost/${raw}`).searchParams
  for (const [key, value] of expected.entries()) {
    if (url.searchParams.get(key) !== value) return false
  }
  return true
}

function waitMsOf(raw: string | null): number {
  if (raw === null) return DEFAULT_WAIT_MS
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) return DEFAULT_WAIT_MS
  return Math.min(value * 1000, MAX_WAIT_MS)
}

function sessionIdOf(session: unknown): string {
  const id = (session as { id?: unknown } | null | undefined)?.id
  return typeof id === 'string' ? id : ''
}

export type { TurnNotifyEvent }
