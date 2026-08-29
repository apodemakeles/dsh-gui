import { join, normalize, resolve, sep } from 'node:path'

const PLUGINS_PREFIX = '/plugins/'
const BUNDLE_SUFFIX = '/client.js'
const MAP_SUFFIX = '/client.js.map'

export function isShellIndexPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index.html'
}

/**
 * Map a URL pathname onto a file inside the official dist.
 * Traversal outside the dist root is rejected (`undefined`).
 * `/` and `/index.html` are also rejected: the assembled boot page is not in dist.
 */
export function resolveDistFile(
  pathname: string,
  distRoot: string,
): string | undefined {
  if (isShellIndexPath(pathname)) return undefined
  const target = resolve(normalize(join(distRoot, pathname)))
  if (target !== distRoot && !target.startsWith(distRoot + sep)) {
    return undefined
  }
  return target
}

/**
 * Map `/plugins/<id>/client.js` (and `.map`) onto a host-resolved bundle path.
 * `id` may contain slashes (`@scope/name`). Query strings must be stripped by
 * the caller. Returns the absolute file path, or `undefined`.
 */
export function resolvePluginAsset(
  pathname: string,
  bundles: ReadonlyMap<string, string>,
): string | undefined {
  const isSourceMap = pathname.startsWith(PLUGINS_PREFIX) && pathname.endsWith(MAP_SUFFIX)
  const suffix = isSourceMap ? MAP_SUFFIX : BUNDLE_SUFFIX
  if (!pathname.startsWith(PLUGINS_PREFIX) || !pathname.endsWith(suffix)) {
    return undefined
  }
  const id = pathname.slice(PLUGINS_PREFIX.length, -suffix.length)
  const clientPath = bundles.get(id)
  if (clientPath === undefined) return undefined
  return isSourceMap ? `${clientPath}.map` : clientPath
}
