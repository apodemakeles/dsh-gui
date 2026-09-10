/**
 * Page-world preload — intentionally empty since dsh 0.1.5.
 *
 * The 0.1.x contract had the preload install `__DSH_TRANSPORT__` with an
 * AbstractApiClient subclass. The 0.1.5 frontend dropped that seam: its boot
 * only reads an optional `loadBundle` hook, and every request rides same-origin
 * fetch, which the dsh-gui:// protocol carries over the Unix socket without
 * page-world help. The file stays as a build target so the window options and
 * electron-vite config need no churn.
 */
export {}
