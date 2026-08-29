import { dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveWebClientDist } from '../src/assembly/web-client-dist.ts'

describe('resolveWebClientDist', () => {
  it('resolves the official frontend index.html', () => {
    const dist = resolveWebClientDist(import.meta.url)
    expect(existsSync(dist.distIndex)).toBe(true)
    expect(dirname(dist.distIndex)).toBe(dist.distRoot)
  })
})
