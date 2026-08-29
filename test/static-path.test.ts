import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  isShellIndexPath,
  resolveDistFile,
  resolvePluginAsset,
} from '../src/assembly/static-path.ts'

describe('isShellIndexPath', () => {
  it('treats / and /index.html as the assembled boot page', () => {
    expect(isShellIndexPath('/')).toBe(true)
    expect(isShellIndexPath('/index.html')).toBe(true)
    expect(isShellIndexPath('/assets/index.js')).toBe(false)
  })
})

describe('resolveDistFile', () => {
  const distRoot = join(tmpdir(), 'dsh-gui-dist-fixture')

  it('does not map the boot path onto the raw dist index', () => {
    expect(resolveDistFile('/', distRoot)).toBeUndefined()
    expect(resolveDistFile('/index.html', distRoot)).toBeUndefined()
  })

  it('maps an asset path inside the dist root', () => {
    expect(resolveDistFile('/assets/index.js', distRoot)).toBe(
      join(distRoot, 'assets/index.js'),
    )
  })

  it('rejects path traversal', () => {
    expect(resolveDistFile('/../secret', distRoot)).toBeUndefined()
  })
})

describe('resolvePluginAsset', () => {
  const bundles = new Map([
    ['@deepseek-ai/dsh-client-modules', '/pkg/modules/lib/client.js'],
  ])

  it('maps a scoped plugin id to its client bundle', () => {
    expect(
      resolvePluginAsset('/plugins/@deepseek-ai/dsh-client-modules/client.js', bundles),
    ).toBe('/pkg/modules/lib/client.js')
  })

  it('maps the matching source map', () => {
    expect(
      resolvePluginAsset('/plugins/@deepseek-ai/dsh-client-modules/client.js.map', bundles),
    ).toBe('/pkg/modules/lib/client.js.map')
  })

  it('returns undefined for an unknown plugin id', () => {
    expect(resolvePluginAsset('/plugins/unknown/client.js', bundles)).toBeUndefined()
  })
})
