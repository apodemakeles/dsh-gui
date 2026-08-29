/** On-disk session handed from the host plugin to the Electron main process. */

export const SESSION_ENV = 'DSH_GUI_SESSION'

/**
 * Launcher contract: when set to a directory path, the host is being spawned
 * BY an already-running shell (the packaged .app). The host then skips
 * spawning Electron itself and writes the session handshake into that
 * directory instead of a private mkdtemp, so the launcher can find it.
 */
export const EXTERNAL_SHELL_DIR_ENV = 'DSH_GUI_EXTERNAL_SHELL_DIR'

export interface ShellSession {
  /** Unix socket where the host serves the shared `/api` fetch handler (no TCP port). */
  socketPath: string
  /** Absolute dist root of `@deepseek-ai/dsh-web-frontend`. */
  distRoot: string
  /** Absolute path of the already-assembled index.html (boot injections applied). */
  indexPath: string
  /** Graph row id → absolute `exports["./client"]` path. */
  pluginBundles: Record<string, string>
}

export function parseShellSession(raw: string): ShellSession {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null) {
    throw new Error('dsh-gui: session payload is not an object')
  }
  const session = value as Partial<ShellSession>
  if (
    typeof session.socketPath !== 'string' ||
    typeof session.distRoot !== 'string' ||
    typeof session.indexPath !== 'string' ||
    !isStringRecord(session.pluginBundles)
  ) {
    throw new Error('dsh-gui: session payload is missing required string fields')
  }
  return session as ShellSession
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((entry) => typeof entry === 'string')
}
