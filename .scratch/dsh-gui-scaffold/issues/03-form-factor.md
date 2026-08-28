# 03 · 产品形态与仓库形态

Type: grilling
Status: resolved
Blocked by: 01

## Question

dsh-gui 到底是什么形态？至少要拆开三问：

1. **宿主形态**：独立桌面 App（自带壳，内嵌/驱动 dsh CLI）vs 走 dsh 官方插件体系挂到一个桌面宿主 profile vs 混合（App 壳 + 官方插件协议）？——取决于 01 查明的官方能力面。
2. **与既有插件的关系**：dsh-deepseek-vision / dsh-token-dashboard / dsh-macos-notify 保持独立仓库被 dsh-gui 运行时聚合，还是 monorepo 收编统一开发？
3. **仓库定位**：单一包 vs pnpm workspace monorepo（壳 + 插件桥 + 未来内聚功能分包）？

## Comments

- 2026-08-21 · 研究输入（来自 [01 · dsh 官方插件规范调研](01-dsh-plugin-standards.md)）：官方**无**桌面宿主（profile 仅 web/headless），但官方架构文档明文为 Electron 预留座位——"a future Electron application reuses the same web client packages over an IPC fetch carrier"，且 webserver README 指明 Electron 走 file:// + IPC fetch、不复用 HTTP server。01 报告给出「双身份」方案：独立 Electron 壳 + 遵循插件协议聚合既有插件。grilling 时以此为基线讨论。

## Answer

（2026-08-27 grilling 落定；过程中先为用户补了一轮 dsh 机制课——三层积木 plugin/bundle/profile、槽位系统、IPC fetch carrier——用户构想与官方预留路径完全吻合。）

1. **宿主形态 = 双身份**：`dsh --profile gui`（自定义 profile，官方一等公民）启动宿主 → dsh-gui bundle（surface bundle，官方的「自带启动入口」机制）拉起 Electron 薄壳 → 壳用 `file://` 加载官方 web client 构建产物、fetch 走 IPC fetch carrier（只换 `doFetch`，契约不变）→ 不重写任何 dsh 核心功能。`dsh gui` 字面别名需上游 PR，暂以 `dsh --profile gui` 为准。
2. **与既有插件的关系（用户前提，非开放问题）**：设计不建立在 token-dashboard / vision 之上，不收编旧仓库；聚合的功能未来在 dsh-gui 里重做。
3. **壳的长期形态**：现在只做「由 dsh 拉起的薄壳」；独立双击 .app（内嵌 Node + dsh）留作未来选项，目录结构不堵死这条路。
4. **仓库定位 = pnpm workspace monorepo**：`apps/` 放 Electron 壳，`packages/` 放 bundle 与未来功能插件；各可安装包独立构建发布（`prepare` 自包含是官方对 git 分发的要求，落到构建配置层处理）。

衍生待解：monorepo 里 bundle 包的安装路径（根包即 bundle vs 子路径 git 依赖）需验证 pnpm git 依赖的 `#path` 支持——已并入 [05 · 目录结构方案定稿](05-directory-layout.md)。
