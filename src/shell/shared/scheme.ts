/** Custom scheme that gives the official dist a real origin (hostname 127.0.0.1). */

export const SHELL_SCHEME = 'dsh-gui'

/** Loopback hostname so the official client treats the page as trusted. */
export const SHELL_HOST = '127.0.0.1'

export const SHELL_ORIGIN = `${SHELL_SCHEME}://${SHELL_HOST}`

/**
 * The client loads from a loopback HTTP surface whose ephemeral port the
 * shell main picks at startup (see main/http-surface.ts): the 0.1.5 gateway
 * derives its `ws://` remote-event mux from the page origin, and Electron
 * strips ports from custom-scheme URLs, so a `dsh-gui://` origin can never
 * carry one. `authToken` (Connection's launch-token query) rides the first
 * navigation so the host mints the browser-auth cookie.
 */
export function clientUrlFor(port: number, authToken: string): string {
  return `http://${SHELL_HOST}:${port}/${authToken}`
}

export const APP_NAME = 'dsh-gui'
