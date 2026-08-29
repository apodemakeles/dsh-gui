import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { writeShellSession } from '../src/host/session-files.ts'
import { findPackageRoot } from '../src/host/shell-paths.ts'

describe('writeShellSession', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  it('writes assembled index and plugin bundle map', async () => {
    const distRoot = mkdtempSync(join(tmpdir(), 'dsh-gui-dist-'))
    dirs.push(distRoot)
    const distIndex = join(distRoot, 'index.html')
    writeFileSync(distIndex, '<html><head></head><body></body></html>')

    const files = await writeShellSession({
      dist: { distRoot, distIndex },
      rawIndex: '<html><head></head><body></body></html>',
      webServer: {
        renderIndex: (html) =>
          html.replace('<head>', '<head><script>window.__DSH_BOOT__={}</script>'),
      },
      clientModules: {
        graph: () => ({ entries: [{ id: '@deepseek-ai/dsh-client-modules' }] }),
        clientPath: (id) =>
          id === '@deepseek-ai/dsh-client-modules' ? '/pkg/modules/lib/client.js' : undefined,
      },
    })
    dirs.push(files.dir)

    const parsed = JSON.parse(await readFile(files.sessionPath, 'utf8')) as {
      pluginBundles: Record<string, string>
      indexPath: string
      socketPath: string
    }
    expect(parsed.pluginBundles['@deepseek-ai/dsh-client-modules']).toBe(
      '/pkg/modules/lib/client.js',
    )
    expect(parsed.socketPath).toBe(files.socketPath)
    const index = await readFile(parsed.indexPath, 'utf8')
    expect(index).toContain('window.__DSH_BOOT__')
  })
})

describe('findPackageRoot', () => {
  it('walks from this test file to the dsh-gui package', () => {
    const root = findPackageRoot(fileURLToPath(import.meta.url))
    expect(root.endsWith('dsh-gui')).toBe(true)
  })
})
