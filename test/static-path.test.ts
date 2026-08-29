import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  combinePluginBundleSources,
  isShellIndexPath,
  resolveDistFile,
  resolvePluginAsset,
  resolvePluginCombo,
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

describe('resolvePluginCombo', () => {
  const bundles = new Map([
    ['dsh-gui', '/pkg/dsh-gui/lib/client.js'],
    ['@scope/other', '/pkg/other/lib/client.js'],
  ])

  it('parses a single-entry combo with a rev query', () => {
    expect(resolvePluginCombo('??dsh-gui/client.js&rev=abc', bundles)).toEqual([
      '/pkg/dsh-gui/lib/client.js',
    ])
  })

  it('parses a multi-entry combo in request order', () => {
    expect(
      resolvePluginCombo('??dsh-gui/client.js,@scope/other/client.js&rev=abc', bundles),
    ).toEqual(['/pkg/dsh-gui/lib/client.js', '/pkg/other/lib/client.js'])
  })

  it('rejects unknown ids, non-client.js resources, and map combos', () => {
    expect(resolvePluginCombo('??unknown/client.js&rev=abc', bundles)).toBeUndefined()
    expect(resolvePluginCombo('??dsh-gui/client.js.map&rev=abc', bundles)).toBeUndefined()
    expect(resolvePluginCombo('??dsh-gui/other.js&rev=abc', bundles)).toBeUndefined()
  })

  it('rejects malformed search strings', () => {
    expect(resolvePluginCombo('', bundles)).toBeUndefined()
    expect(resolvePluginCombo('??', bundles)).toBeUndefined()
    expect(resolvePluginCombo('?q=1', bundles)).toBeUndefined()
  })
})

describe('combinePluginBundleSources', () => {
  it('strips sourceMappingURL trailers and separates bundles with a semicolon', () => {
    const combined = combinePluginBundleSources([
      'window.__ModuleLoader__.load({ id: "a" })\n//# sourceMappingURL=client.js.map',
      "var x = 'b'",
    ])
    expect(combined).toBe(
      'window.__ModuleLoader__.load({ id: "a" })\n;\nvar x = \'b\'\n',
    )
    expect(combined).not.toContain('sourceMappingURL')
  })
})
