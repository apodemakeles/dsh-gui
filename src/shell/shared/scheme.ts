/** Custom scheme that gives the official dist a real origin (hostname 127.0.0.1). */

export const SHELL_SCHEME = 'dsh-gui'

/** Loopback hostname so the official client treats the page as trusted. */
export const SHELL_HOST = '127.0.0.1'

export const SHELL_ORIGIN = `${SHELL_SCHEME}://${SHELL_HOST}`

export const INDEX_URL = `${SHELL_ORIGIN}/index.html`

export const APP_NAME = 'dsh-gui'
