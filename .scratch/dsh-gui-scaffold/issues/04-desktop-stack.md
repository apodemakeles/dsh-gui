# 04 · 桌面技术栈选型

Type: grilling
Status: resolved
Blocked by: 03

## Question

桌面壳与前端选什么？候选与考量：

- **Electron**：agent-connector 已有先例（main/preload/renderer/shared 结构、electron-vite、macOS 打包脚本可复用）；生态成熟；体积大
- **Tauri**：轻量、Rust 侧成本；与 dsh（Node 生态插件）桥接成本
- 前端框架（React/Vue/原生）与状态管理——只需定到影响目录结构的粒度
- 构建/打包链（electron-vite vs vite+electron-builder 等）与自动更新通道的技术前提

03 已定 Electron 壳（薄壳、由 dsh 拉起）；本票剩余范围：前端框架（React/Vue/原生，只需定到影响目录结构的粒度）、构建/打包链（electron-vite 先例可复用 vs vite + electron-builder）、自动更新通道的技术前提。

## Comments

- 2026-08-21 · 研究输入（来自 [01](01-dsh-plugin-standards.md) / [02](02-oss-repo-standards.md)）：官方 webserver 文档的技术叙事直接指向 Electron（file:// + IPC fetch carrier）；agent-connector 的 Electron 工具链（electron-vite、main/preload/renderer/shared、macOS 打包脚本）可复用；Tauri 与 dsh 的 Node 插件生态桥接成本更高。两套 .gitignore 与发布产物惯例（electron-builder vs tauri-action）已备查。

## Answer

（2026-08-27 grilling 落定。03 已定 Electron 薄壳，本票剩余两问一实一策：）

1. **前端 = React（事实锁定，非选择）**：官方 web client 是 React；槽位系统注册的就是 React 组件；插件 client 半区的模块表把 React 冻结为 external——未来功能插件的界面代码必须是 React 才挂得进槽位。壳的渲染层只是 `file://` 加载官方 client，本身不另起框架、不引入状态管理选型（低于影响目录结构的粒度）。
2. **构建/打包链 = electron-vite + electron-builder（用户拍板）**：与 agent-connector 完全同构——electron-vite 管 dev/build（main/preload/renderer 三目标，配置约 5 行），electron-builder 管打包（先 `--mac dir --arm64` 本地验证，未来出 .app 加 target 即可）。零新工具知识成本，本屋已跑通。
3. **随带定案的本屋标准**：pnpm + TypeScript + vitest + `typecheck` 独立脚本（三仓库一致惯例）；Electron 取 agent-connector 同代或更新 stable（37+），具体版本 08 落地时定。
4. **自动更新**：薄壳以插件身份分发，更新天然走 `dsh plugin update`；electron-updater（`latest*.yml` 基础设施）**不引入**，留给未来独立 .app 选项。
