import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { dshSearchPaths, locateDshBinary, DSH_BIN_ENV } from '../src/assembly/launch.ts'

describe('dshSearchPaths', () => {
  it('puts an explicit override first, then the known prefixes', () => {
    const paths = dshSearchPaths({ [DSH_BIN_ENV]: '/custom/dsh' }, '/Users/tester')
    expect(paths[0]).toBe('/custom/dsh')
    expect(paths).toContain('/opt/homebrew/bin/dsh')
    expect(paths).toContain('/usr/local/bin/dsh')
    expect(paths).toContain(join('/Users/tester', '.dsh/bin/dsh'))
  })

  it('skips an empty override', () => {
    const paths = dshSearchPaths({ [DSH_BIN_ENV]: '' }, '/home/x')
    expect(paths[0]).toBe('/opt/homebrew/bin/dsh')
  })

  it('works without an override at all', () => {
    const paths = dshSearchPaths({}, '/home/x')
    expect(paths).toHaveLength(3)
  })
})

describe('locateDshBinary', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  function temp(name: string): string {
    const dir = mkdtempSync(join(tmpdir(), name))
    dirs.push(dir)
    return dir
  }

  it('returns the first executable candidate', () => {
    const dir = temp('dsh-gui-loc-')
    const good = join(dir, 'dsh')
    writeFileSync(good, '#!/bin/sh\n', 'utf8')
    chmodSync(good, 0o755)
    expect(locateDshBinary([join(dir, 'missing'), good])).toBe(good)
  })

  it('skips candidates that exist but are not executable', () => {
    const dir = temp('dsh-gui-loc-')
    const locked = join(dir, 'dsh')
    writeFileSync(locked, 'data', 'utf8')
    chmodSync(locked, 0o644)
    expect(locateDshBinary([locked])).toBeUndefined()
  })

  it('returns undefined when nothing matches', () => {
    const dir = temp('dsh-gui-loc-')
    expect(locateDshBinary([join(dir, 'nope-1'), join(dir, 'nope-2')])).toBeUndefined()
    expect(existsSync(dir)).toBe(true)
  })
})
