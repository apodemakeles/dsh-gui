import { spawn, type ChildProcess } from 'node:child_process'
import type { ShellPaths } from './shell-paths.ts'
import { SESSION_ENV } from '../assembly/session.ts'

export interface SpawnedShell {
  child: ChildProcess
  stop(): void
}

/**
 * Launch the Electron main with a session file. stdio inherit so host logs
 * stay on the dsh terminal; the session path is the only extra env.
 */
export function spawnElectronShell(
  paths: ShellPaths,
  sessionPath: string,
): SpawnedShell {
  const child = spawn(paths.electronBinary, [paths.mainEntry], {
    env: {
      ...process.env,
      [SESSION_ENV]: sessionPath,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  let stopped = false
  const onHostExit = () => stop()
  process.once('exit', onHostExit)
  const stop = () => {
    process.removeListener('exit', onHostExit)
    if (stopped) return
    stopped = true
    if (!child.killed) child.kill()
  }
  return { child, stop }
}
