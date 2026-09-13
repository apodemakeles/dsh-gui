// turn-notify feature — session title resolution (pure).
//
// spec.md §2.4: log-backed title from the sessionTitle service, falling back
// to the header cwd basename, then the session id. Defensive on purpose: the
// live Session/SessionTitleSnapshot shapes arrive as `unknown` through the
// cordis listener.

/**
 * Resolve the notification title for a session.
 * @param session - the live Session object from the `session/event` listener.
 * @param titleSnapshot - `ctx.sessionTitle.get(session)`, when the service is mounted.
 */
export function titleOfSession(session: unknown, titleSnapshot: unknown): string {
  const title = (titleSnapshot as { title?: unknown } | null | undefined)?.title
  if (typeof title === 'string' && title.trim() !== '') return title

  const header = (session as { header?: { cwd?: unknown } } | null | undefined)?.header
  const cwd = typeof header?.cwd === 'string' ? header.cwd : undefined
  const base = cwd?.split(/[\\/]/).filter((part) => part !== '').pop()
  if (base !== undefined && base !== '') return base

  const id = (session as { id?: unknown } | null | undefined)?.id
  if (typeof id === 'string' && id !== '') return id
  return '未命名会话'
}
