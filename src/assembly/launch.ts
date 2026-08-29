/**
 * Pure helpers for the launcher .app. A Finder-launched app has no user PATH,
 * so the dsh CLI must be located by probing known install prefixes (or an
 * explicit override kept next to the handshake contract in session.ts).
 */
import { accessSync, constants } from 'node:fs'
import { join } from 'node:path'

/** Escape hatch when dsh lives outside the probed prefixes. */
export const DSH_BIN_ENV = 'DSH_GUI_DSH_BIN'

/** Handshake file names inside the launcher-provided run directory. */
export const SESSION_FILE = 'session.json'
export const HOST_SOCKET = 'host.sock'

export type LaunchEnv = { [DSH_BIN_ENV]?: string | undefined }

/**
 * Where to look for the dsh CLI, most specific first: an explicit override
 * (kept per-app via `launchctl setenv`, or a wrapper script), then the common
 * global prefixes.
 */
export function dshSearchPaths(env: LaunchEnv, home: string): string[] {
  const paths: string[] = []
  const override = env[DSH_BIN_ENV]
  if (override !== undefined && override !== '') paths.push(override)
  paths.push(
    '/opt/homebrew/bin/dsh',
    '/usr/local/bin/dsh',
    join(home, '.dsh', 'bin', 'dsh'),
  )
  return paths
}

/** First candidate that exists and is executable, or undefined. */
export function locateDshBinary(candidates: readonly string[]): string | undefined {
  for (const path of candidates) {
    try {
      accessSync(path, constants.X_OK)
      return path
    } catch {
      // try the next prefix
    }
  }
  return undefined
}
