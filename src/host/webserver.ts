/**
 * In-process webServer: the same registration + index-injection face as
 * `@deepseek-ai/dsh-host-webserver`, without binding a TCP port.
 *
 * client-modules and connection inject this service. The Electron window never
 * loads from it; plugin bundles and dist are served through the custom protocol.
 *
 * `register` / `registerUpgrade` / `registerFallback` stay on the face because
 * official plugins call them at boot (`connection` mounts `/api` + WebSocket
 * upgrades; `dsh-web-app` mounts frontend-static on the fallback seat). This
 * shell never dispatches those tables — `/api` rides Unix fetch instead.
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import {
  renderIndexInjections,
  type IndexInjection,
  type WebRoute,
  type WebUpgradeRoute,
} from '@deepseek-ai/dsh-host-webserver'

export const name = 'web-server'

/**
 * Longest-prefix-wins after an exact-table miss — same rule as
 * `@deepseek-ai/dsh-host-webserver`.
 */
export function matchWebRoute(
  pathname: string,
  exact: ReadonlyMap<string, WebRoute>,
  prefixes: ReadonlyMap<string, WebRoute>,
): WebRoute | undefined {
  const hit = exact.get(pathname)
  if (hit !== undefined) return hit
  let best: WebRoute | undefined
  for (const [prefix, route] of prefixes) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue
    if (best === undefined || prefix.length > best.path.length) best = route
  }
  return best
}

export class SilentWebServer extends Service {
  private readonly exact = new Map<string, WebRoute>()
  private readonly prefixes = new Map<string, WebRoute>()
  private readonly upgrades = new Map<string, WebUpgradeRoute>()
  private readonly indexTaps: Array<(html: string) => string> = []
  private fallback: WebRoute['handler'] | undefined

  constructor(ctx: Context) {
    super(ctx, 'webServer')
  }

  /** No TCP listen; 0 is a sentinel so callers that print a URL see a non-port. */
  get port(): number {
    return 0
  }

  get host(): '127.0.0.1' {
    return '127.0.0.1'
  }

  register(route: WebRoute): () => void {
    const table = route.kind === 'exact' ? this.exact : this.prefixes
    if (table.has(route.path)) {
      throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
    }
    table.set(route.path, route)
    return () => {
      table.delete(route.path)
    }
  }

  registerUpgrade(route: WebUpgradeRoute): () => void {
    if (this.upgrades.has(route.path)) {
      throw new Error(`webserver: duplicate upgrade route "${route.path}"`)
    }
    this.upgrades.set(route.path, route)
    return () => {
      this.upgrades.delete(route.path)
    }
  }

  registerFallback(handler: WebRoute['handler']): () => void {
    if (this.fallback !== undefined) {
      throw new Error('webserver: fallback seat already claimed')
    }
    this.fallback = handler
    return () => {
      this.fallback = undefined
    }
  }

  tapIndex(transform: (html: string) => string): () => void {
    this.indexTaps.push(transform)
    return () => {
      const index = this.indexTaps.indexOf(transform)
      if (index >= 0) this.indexTaps.splice(index, 1)
    }
  }

  applyIndexTaps(html: string): string {
    let out = html
    for (const transform of this.indexTaps) out = transform(out)
    return out
  }

  collectIndexInjections(): IndexInjection[] {
    const table: IndexInjection[] = []
    this.ctx.emit('webserver/index-inject', table)
    return table
  }

  renderIndex(html: string): string {
    return this.applyIndexTaps(renderIndexInjections(html, this.collectIndexInjections()))
  }
}

export default SilentWebServer

export function apply(ctx: Context): void {
  ctx.plugin(SilentWebServer)
}
