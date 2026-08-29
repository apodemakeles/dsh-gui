/**
 * Package the launcher .app locally (release/, arm64, unpacked, unsigned).
 *
 * electron-builder cannot run against this package directly: it refuses
 * `dependencies.electron` (which dsh plugin installs NEED — the host half
 * resolves the binary via require('electron')), and its "collect production
 * node_modules" step would rewrite the lockfile and prune electron while the
 * manifest is temporarily stripped. So we hand it an isolated staging project
 * instead: a minimal manifest (build config cloned from ours, output pointed
 * back at ../release) plus a copy of out/. Nothing in the repo is touched.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// Outside the repo on purpose: electron-builder's "searching for node
// modules" walks up for a pnpm-lock.yaml and would otherwise bundle the
// host-side production deps (a gigabyte of them) into the shell's asar.
const staging = mkdtempSync(join(tmpdir(), 'dsh-gui-pack-'))

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const electronVersion = JSON.parse(
  readFileSync(join(root, 'node_modules/electron/package.json'), 'utf8'),
).version

const build = structuredClone(pkg.build)
build.directories = { output: join(root, 'release') }
build.mac = { ...build.mac, icon: join(root, 'build/icon.icns') }

cpSync(join(root, 'out'), join(staging, 'out'), { recursive: true })
writeFileSync(
  join(staging, 'package.json'),
  JSON.stringify(
    {
      name: 'dsh-gui',
      version: pkg.version,
      description: pkg.description,
      main: 'out/main/index.js',
      author: 'apodemakeles',
      build,
    },
    null,
    2,
  ) + '\n',
)

let exitCode = 1
try {
  // npmRebuild=false: no dependency install/rebuild against the staging
  // manifest (the .app ships out/ only).
  const result = spawnSync(
    join(root, 'node_modules/.bin/electron-builder'),
    ['--mac', 'dir', '--arm64', `--config.electronVersion=${electronVersion}`, '--config.npmRebuild=false'],
    { cwd: staging, stdio: 'inherit' },
  )
  exitCode = result.status ?? 1
} finally {
  rmSync(staging, { recursive: true, force: true })
}

process.exit(exitCode)
