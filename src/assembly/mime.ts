/** MIME types for the official web-frontend dist and plugin classic scripts. */

const HTML = 'text/html; charset=utf-8'

const BY_EXTENSION: Record<string, string> = {
  '.html': HTML,
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

export const HTML_MIME = HTML

/** Content-Type for a dist or plugin file; unknown extensions are octet-stream. */
export function mimeForFile(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return 'application/octet-stream'
  const ext = filePath.slice(dot).toLowerCase()
  return BY_EXTENSION[ext] ?? 'application/octet-stream'
}
