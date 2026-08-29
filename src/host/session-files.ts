import { mkdtemp, writeFile } from 'node:fs/promises'
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
 */
export async function writeShellSession(input: {
  dist: DistLayout
  rawIndex: string
  webServer: IndexRenderer
  clientModules: ClientModuleFace
}): Promise<SessionFiles> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gui-'))
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
  await writeFile(sessionPath, JSON.stringify(session), 'utf8')
  return { dir, sessionPath, socketPath, indexPath }
}
