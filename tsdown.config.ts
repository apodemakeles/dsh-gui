/**
 * Host-half + client-half build for the dsh-gui bundle:
 * - host    src/index.ts + src/host/webserver.ts -> lib/*.mjs (node, dts)
 * - worker  src/features/token-usage/host/usage-worker.ts -> lib/usage-worker.js
 *           (spawned via `new Worker(new URL('./usage-worker.js', import.meta.url), { type: 'module' })`
 *           — the explicit type keeps it working on node 20, which does not
 *           auto-detect ESM in classic workers)
 * - cli     src/features/token-usage/cli.ts -> lib/cli.js (bin: dsh-gui-token-usage)
 * - client  src/client/index.ts -> lib/client.js (browser; NOT a plain ESM
 *           module — a closure-factory bundle self-registering via
 *           `window.__ModuleLoader__.load({ id, factory })`, served at
 *           /plugins/dsh-gui/client.js; externals resolve through the web
 *           shell's frozen module table)
 *
 * Host/worker/cli imports stay external automatically: peerDependencies are
 * resolved at runtime from the dsh profile tree (pinned per AGENTS.md §6).
 */
import { defineConfig } from 'tsdown'

// Client-half platform modules: the specifiers the web shell shares into the
// frozen module table. They stay external and resolve at factory-run time
// through the require() the module loader injects. Trimmed to what this
// bundle's client code actually imports (react + the slot/locale runtime).
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

export default defineConfig([
  {
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
  },
  {
    entry: { 'usage-worker': 'src/features/token-usage/host/usage-worker.ts' },
    outDir: 'lib',
    format: 'esm',
    fixedExtension: false, // emit .js: the spawn URL in worker-client.ts names it exactly
    dts: false,
    deps: {
      neverBundle: ['electron', /^@deepseek-ai\//],
    },
    sourcemap: true,
    clean: false,
  },
  {
    entry: { cli: 'src/features/token-usage/cli.ts' },
    outDir: 'lib',
    format: 'esm',
    fixedExtension: false, // bin expects lib/cli.js
    dts: false,
    deps: {
      neverBundle: ['electron', /^@deepseek-ai\//],
    },
    sourcemap: true,
    clean: false,
  },
  {
    name: 'client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false, // dts here would wrap the banner/footer into .d.cts and break parsing
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
    },
    sourcemap: true,
    clean: false, // a clean here would wipe the host-half lib/*.mjs above
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js', // cjs format would otherwise name it client.cjs
      banner: 'window.__ModuleLoader__.load({ id: "@apodemakeles/dsh-gui", factory: (require) => {',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
