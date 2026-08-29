import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import { fetchOverUnixSocket } from '../../assembly/unix-http.ts'
import { mimeForFile, HTML_MIME } from '../../assembly/mime.ts'
import {
  isShellIndexPath,
  resolveDistFile,
  resolvePluginAsset,
} from '../../assembly/static-path.ts'
import type { ShellSession } from '../../assembly/session.ts'
import { SHELL_SCHEME } from '../shared/scheme.ts'

export function installShellProtocol(session: ShellSession): void {
  const bundles = new Map(Object.entries(session.pluginBundles))

  protocol.handle(SHELL_SCHEME, async (request) => {
    const url = new URL(request.url)
    const pathname = decodeURIComponent(url.pathname)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return fetchOverUnixSocket(session.socketPath, request)
    }

    if (isShellIndexPath(pathname)) {
      const html = await readFile(session.indexPath, 'utf8')
      return new Response(html, {
        status: 200,
        headers: { 'content-type': HTML_MIME },
      })
    }

    const pluginPath = resolvePluginAsset(pathname, bundles)
    if (pluginPath !== undefined) {
      return fileResponse(pluginPath)
    }

    const distFile = resolveDistFile(pathname, session.distRoot)
    if (distFile === undefined) {
      return new Response('forbidden', { status: 403 })
    }
    return fileResponse(distFile)
  })
}

async function fileResponse(filePath: string): Promise<Response> {
  try {
    const body = await readFile(filePath)
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': mimeForFile(filePath),
        'cache-control': 'no-cache',
      },
    })
  } catch {
    return new Response('not found', { status: 404 })
  }
}
