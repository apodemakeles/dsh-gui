import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export interface ShellPaths {
  packageRoot: string
  electronBinary: string
  mainEntry: string
}

/**
 * Walk from a module URL (plugin `lib/index.mjs` or source `src/index.ts`)
 * to this package's root, then resolve the Electron binary and the built main.
 */
export function resolveShellPaths(fromModuleUrl: string): ShellPaths {
  const packageRoot = findPackageRoot(fileURLToPath(fromModuleUrl))
  const require = createRequire(join(packageRoot, 'package.json'))
  let electronBinary: string
  try {
    electronBinary = require('electron') as string
  } catch {
    throw new Error(
      'dsh-gui: electron binary not found. The plugin lists electron as a dependency; reinstall the gui profile.',
    )
  }
  const mainEntry = join(packageRoot, 'out/main/index.js')
  if (!existsSync(mainEntry)) {
    throw new Error(
      `dsh-gui: shell main missing at ${mainEntry}. The package prepare script must run electron-vite build.`,
    )
  }
  return { packageRoot, electronBinary, mainEntry }
}

export function findPackageRoot(fromFile: string): string {
  let dir = dirname(fromFile)
  while (true) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest)) {
      const pkg: unknown = JSON.parse(readFileSync(manifest, 'utf8'))
      if (
        typeof pkg === 'object' &&
        pkg !== null &&
        'name' in pkg &&
        (pkg as { name: unknown }).name === '@apodemakeles/dsh-gui'
      ) {
        return dir
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error('dsh-gui: package root not found from ' + fromFile)
    }
    dir = parent
  }
}
