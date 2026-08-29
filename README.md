# dsh-gui

English | [中文](README.zh.md)

> Desktop shell for [dsh](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness): an Electron app delivered as a dsh bundle. Boot it with `dsh --profile gui` — it reuses the official dsh web client over an IPC fetch carrier instead of reimplementing harness features.

**Status: shell assembly.** `dsh --profile gui` launches Electron, loads the official web client over a custom protocol (`dsh-gui://`, no TCP port), and carries fetch over an IPC/unix-socket carrier. `pnpm dev` still opens a placeholder window because boot graph and `apiProxy` only exist inside a live host.

![dsh-gui session](docs/images/session.png)

## Install (target usage)

Requires dsh `0.1.x-rc`:

```sh
dsh plugin --profile gui add github:apodemakeles/dsh-gui
dsh --profile gui
```

Because the shell ships Electron as a runtime dependency, pnpm will ask you to approve build scripts once: copy the printed package keys (`@apodemakeles/dsh-gui` and `electron`) into the `allowBuilds` list of your profile's `pnpm-workspace.yaml`, then re-run `add`.

## Development

- Node `>= 20`, pnpm (the version is pinned via `packageManager`).

```sh
pnpm install        # also runs prepare → build (electron-vite + tsdown)
pnpm dev            # placeholder window (the real client needs `dsh --profile gui`)
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm build          # electron-vite build (out/) + tsdown (lib/)
pnpm package:mac    # local unpacked .app under release/ (arm64)
```

Distro facts in brief: single installable package (`dsh.bundle.patch` in `package.json`), plugin output in `lib/` built at install time via `prepare`, shell output in `out/`. Agent-facing conventions live in [AGENTS.md](AGENTS.md) (Chinese); the domain glossary lives in [CONTEXT.md](CONTEXT.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: short-lived branches + squash-merge PRs, conventional-commit prefixes (`feat:` / `fix:` / `chore:` / `docs:`).

## License

[MIT](LICENSE) © 2026 apodemakeles
