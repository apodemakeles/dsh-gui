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

/**
 * Parse the combo form the boot graph uses for plugin bundles:
 * `??<id1>/client.js,<id2>/client.js&rev=<hash>` (the `??…&rev=…` part is the
 * URL's search string — the pathname is just `/plugins/`). Every listed
 * resource must resolve; the official server 404s unknown or stale entries
 * rather than serving a partial combo. Source-map combos are not served
 * (executables carry no combined map; missing maps never block execution).
 *
 * @returns the bundle paths in request order, or `undefined` when the search
 * string is not a well-formed combo of known `client.js` resources.
 */
export function resolvePluginCombo(
  search: string,
  bundles: ReadonlyMap<string, string>,
): string[] | undefined {
  if (!search.startsWith('??')) return undefined
  const [resourcePart] = search.slice(2).split('&')
  if (resourcePart === undefined || resourcePart === '') return undefined
  const paths: string[] = []
  for (const resource of resourcePart.split(',')) {
    const id = resource.endsWith(BUNDLE_SUFFIX)
      ? resource.slice(0, -BUNDLE_SUFFIX.length)
      : undefined
    if (id === undefined || id === '') return undefined
    const clientPath = bundles.get(id)
    if (clientPath === undefined) return undefined
    paths.push(clientPath)
  }
  return paths
}

/**
 * Concatenate bundle sources into one classic script, mirroring the official
 * combo semantics: strip each bundle's sourceMappingURL trailer (it would
 * resolve against the combo URL), guarantee a trailing newline, and separate
 * entries with `;\n` so a bundle without a trailing semicolon cannot merge
 * into the next one's `window.__ModuleLoader__.load(` banner.
 */
export function combinePluginBundleSources(sources: readonly string[]): string {
  return sources
    .map((source) => stripSourceMapTrailer(source))
    .map((source) => (source.endsWith('\n') ? source : `${source}\n`))
    .join(';\n')
}

function stripSourceMapTrailer(source: string): string {
  return source.replace(/\n*\/\/# sourceMappingURL=\S*\s*$/g, '')
}
