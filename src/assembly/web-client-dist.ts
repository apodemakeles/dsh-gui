import { createRequire } from 'node:module'
import { dirname } from 'node:path'

export interface DistLayout {
  /** Absolute path of the official `index.html` (inside distRoot). */
  distIndex: string
  /** Directory containing that index (the dist root). */
  distRoot: string
}

/**
 * Locate the official web client dist shipped as `@deepseek-ai/dsh-web-frontend`.
 * Resolution walks from `from` (typically `import.meta.url` of the caller).
 */
export function resolveWebClientDist(from: string): DistLayout {
  const require = createRequire(from)
  let distIndex: string
  try {
    distIndex = require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')
  } catch {
    throw new Error(
      'dsh-gui: official web client dist not found (package @deepseek-ai/dsh-web-frontend). Install dsh 0.1.1-rc.1 or add that package to this plugin.',
    )
  }
  return { distIndex, distRoot: dirname(distIndex) }
}
