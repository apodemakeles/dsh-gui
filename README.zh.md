# dsh-gui

[English](README.md) | 中文

> [dsh](https://github.com/deepseek-ai/deepseek-harness)（DeepSeek Harness）的桌面壳：以 dsh 插件（bundle）身份交付的 Electron 应用。`dsh --profile gui` 一键拉起——复用官方 web client、经 IPC fetch carrier 通信，不重造 harness 功能。

**当前状态：脚手架。** 仓库骨架、构建链与 CI 已就位；Electron 壳的装配（web client 加载、IPC fetch carrier、插件引导）是下一个开发阶段。下面「安装」一节描述的是目标用法。

<!-- 壳渲染出 web client 后，截图放 docs/images/。 -->

## 安装（目标用法）

需要 dsh `0.1.x-rc`：

```sh
dsh plugin --profile gui add github:apodemakeles/dsh-gui
dsh --profile gui
```

由于壳把 Electron 作为运行时依赖，pnpm 会要求你授权一次构建脚本：把打印出来的包名（`@apodemakeles/dsh-gui` 和 `electron`）抄进你 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds` 列表，再重跑一次 `add` 即可。

## 开发

- Node `>= 20`，pnpm（版本已通过 `packageManager` 锁定）。

```sh
pnpm install        # 同时执行 prepare → build（electron-vite + tsdown）
pnpm dev            # 占位窗口（web client 装配在设计阶段落地）
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm build          # electron-vite build（out/）+ tsdown（lib/）
pnpm package:mac    # 本地未打包 .app，输出在 release/（arm64）
```

形态速览：单一可安装包（`package.json` 的 `dsh.bundle.patch`），插件产物 `lib/` 由安装期 `prepare` 构建，壳产物在 `out/`。面向 agent 的完整规约见 [AGENTS.md](AGENTS.md)（中文）；领域术语表见 [CONTEXT.md](CONTEXT.md)。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。要点：短命分支 + squash 合并的 PR，约定式提交前缀（`feat:` / `fix:` / `chore:` / `docs:`）。

## 许可证

[MIT](LICENSE) © 2026 apodemakeles
