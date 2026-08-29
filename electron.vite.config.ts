/**
 * Electron shell build (three targets, agent-connector lineage):
 * - main:     src/shell/main/index.ts     -> out/main/index.js
 * - preload:  src/shell/preload/index.ts  -> out/preload/index.mjs
 * - renderer: src/shell/renderer/         -> out/renderer/
 * The dsh plugin half (src/index.ts) is built separately by tsdown -> lib/.
 */
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: 'src/shell/main/index.ts' },
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({ exclude: ['@deepseek-ai/dsh-host-apiproxy'] }),
    ],
    build: {
      rollupOptions: {
        input: { index: 'src/shell/preload/index.ts' },
      },
    },
  },
  renderer: {
    root: 'src/shell/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        // electron-vite requires an explicit renderer input (v4 resolved-config hook).
        input: { index: resolve('src/shell/renderer/index.html') },
      },
    },
  },
})
