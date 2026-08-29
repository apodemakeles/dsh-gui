# dsh-gui

[English](README.md) | 中文

> [dsh](https://github.com/deepseek-ai/deepseek-harness)（DeepSeek Harness）的桌面壳：以 dsh 插件（bundle）身份交付的 Electron 应用。`dsh --profile gui` 一键拉起——复用官方 web client、经 IPC fetch carrier 通信，不重造 harness 功能。

**当前状态：壳装配已落地，首个功能模块（token 消耗）已内置。** `dsh --profile gui` 拉起 Electron，用自定义协议（`dsh-gui://`，不开 TCP 端口）加载官方 web client，请求经 IPC/Unix socket carrier 回宿主。侧栏底部的 "usage" 入口打开 token 消耗面板（今日/本周/近 30 天/总量 + GitHub 风格周热力图 + 按模型 Top3）。`pnpm dev` 仍是占位窗口：引导图和 `apiProxy` 只存在于活的宿主进程里。

![dsh-gui 会话](docs/images/session.png)

## token 消耗面板

数据链与独立插件 [dsh-token-dashboard](https://github.com/apodemakeles/dsh-token-dashboard) 一致：宿主监听会话事件、Worker 线程独占 SQLite 投影（`$DSH_HOME/data/token-dashboard/usage-v1.sqlite`），面板只读一个 snapshot 端点；权威数据始终是 `~/.dsh/sessions`，库可随时重建。

- **历史数据连续**：沿用同一个库文件，原插件的统计直接延续；插件不在场期间（如仅 CLI/gui 使用）产生的会话，下次启动会自动从会话日志补投影。
- 维护 CLI：`dsh-gui-token-usage status | verify | rebuild | backups | restore | cleanup`（写操作需精确名 + `--yes`）。

## 安装（目标用法）

需要 dsh `0.1.x-rc`：

```sh
dsh plugin --profile gui add github:apodemakeles/dsh-gui
dsh --profile gui
```

由于壳把 Electron 作为运行时依赖，pnpm 会要求你授权一次构建脚本：把打印出来的包名（`@apodemakeles/dsh-gui` 和 `electron`）抄进你 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds` 列表，再重跑一次 `add` 即可。

## 开发

- Node `>= 22.5`（`node:sqlite`），pnpm（版本已通过 `packageManager` 锁定）。

```sh
pnpm install        # 同时执行 prepare → build（electron-vite + tsdown）
pnpm dev            # 占位窗口（真实 web client 需要 `dsh --profile gui`）
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
