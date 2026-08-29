/**
 * Host-half build: src/index.ts -> lib/index.mjs (the dsh plugin entry that
 * `cordis.patch.yml` activates). The Electron shell half is built by
 * electron-vite into out/ (see electron.vite.config.ts).
 *
 * Host-half imports stay external automatically: peerDependencies are
 * resolved at runtime from the dsh profile tree (pinned per AGENTS.md §6).
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webserver: 'src/host/webserver.ts',
  },
  outDir: 'lib',
  format: 'esm',
  dts: true,
  deps: {
    neverBundle: ['electron', /^@deepseek-ai\//],
  },
})
