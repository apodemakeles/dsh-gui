import { mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ShellSession } from '../assembly/session.ts'
import type { DistLayout } from '../assembly/web-client-dist.ts'

export interface SessionFiles {
  dir: string
  sessionPath: string
  socketPath: string
  indexPath: string
}

export interface ClientModuleFace {
  graph(): { entries: readonly { id: string }[] }
  clientPath(id: string): string | undefined
}

export interface IndexRenderer {
  renderIndex(html: string): string
}

/**
 * Write the assembled index and the session JSON the Electron process reads.
 *
 * `dirOverride` is the launcher contract: instead of a private mkdtemp the
 * handshake lands in the caller-provided run directory. session.json is then
 * published via rename so the polling launcher never reads a half-written
 * payload.
 */
export async function writeShellSession(input: {
  dist: DistLayout
  rawIndex: string
  webServer: IndexRenderer
  clientModules: ClientModuleFace
  dirOverride?: string
}): Promise<SessionFiles> {
  let dir: string
  if (input.dirOverride !== undefined && input.dirOverride !== '') {
    dir = input.dirOverride
    await mkdir(dir, { recursive: true })
  } else {
    dir = await mkdtemp(join(tmpdir(), 'dsh-gui-'))
  }
  const socketPath = join(dir, 'host.sock')
  const indexPath = join(dir, 'index.html')
  const sessionPath = join(dir, 'session.json')
  const assembled = input.webServer.renderIndex(input.rawIndex)
  await writeFile(indexPath, assembled, 'utf8')

  const pluginBundles: Record<string, string> = {}
  for (const row of input.clientModules.graph().entries) {
    const clientPath = input.clientModules.clientPath(row.id)
    if (clientPath !== undefined) pluginBundles[row.id] = clientPath
  }

  const session: ShellSession = {
    socketPath,
    distRoot: input.dist.distRoot,
    indexPath,
    pluginBundles,
  }
  await writeFile(sessionPath + '.tmp', JSON.stringify(session), 'utf8')
  await rename(sessionPath + '.tmp', sessionPath)
  return { dir, sessionPath, socketPath, indexPath }
}
