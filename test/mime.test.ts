import { describe, expect, it } from 'vitest'
import { mimeForFile } from '../src/assembly/mime.ts'

describe('mimeForFile', () => {
  it('maps official dist extensions the shell actually serves', () => {
    expect(mimeForFile('/dist/index.html')).toBe('text/html; charset=utf-8')
    expect(mimeForFile('/dist/assets/index.js')).toBe('text/javascript; charset=utf-8')
    expect(mimeForFile('/dist/assets/index.css')).toBe('text/css; charset=utf-8')
    expect(mimeForFile('/dist/assets/font.woff2')).toBe('font/woff2')
    expect(mimeForFile('/dist/assets/font.woff')).toBe('font/woff')
    expect(mimeForFile('/dist/assets/font.ttf')).toBe('font/ttf')
  })

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeForFile('/dist/assets/unknown.bin')).toBe('application/octet-stream')
  })
})
