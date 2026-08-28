# 01 · dsh 官方插件规范与桌面宿主能力调研

Type: research
Status: resolved

## Question

官方 DeepSeek Harness（github.com/deepseek-ai/deepseek-harness）的插件体系到底规定了什么？一个「标准的 dsh 插件」需要哪些文件与说明？具体要查清：

- 插件的清单/描述方式（manifest 文件？package.json 约定字段？）、`prepare` 构建约定
- profile 机制（`--profile web`）的语义：有哪些宿主 profile？是否已存在 desktop/GUI 宿主？
- 分发方式（`dsh plugin add github:owner/repo`）对仓库结构的要求
- 插件能触达的宿主 API 面：UI 注册（侧栏/面板/设置卡）、事件（`session/event`）、Worker、持久化
- `~/.dsh/settings.yaml` 配置集成、能力门控（如 `inputModalities`）
- dsh 版本兼容策略（当前 0.1.0-rc.x）
- 同时盘点作者本地两个已发布插件 + agent-connector 的实际文件清单与工具链（package.json 关键字段、LICENSE、CI、测试、README/i18n 惯例、CONTEXT.md、cordis.patch.yml 的作用），提炼「本屋插件事实标准」

## Answer

调研完成（2026-08-21，官方仓库 main@141eb6f = 0.1.0-rc.8 通读 + 本屋三仓库实测），完整报告：[research/dsh-plugin-standards.md](../research/dsh-plugin-standards.md)。要点：

- **官方无桌面宿主**：出厂 profile 仅 web/headless；但官方架构文档在四处明文为 Electron 预留座位——GUI 分层 note 称 "a future Electron application reuses the same web client packages over an IPC fetch carrier"，webserver README 指明 Electron 走 file:// + IPC fetch、不复用 HTTP server。**dsh-gui 做独立 Electron App 在官方叙事内可行**，但 RPC 无协议版本号，需与 dsh 版本 pin 对齐。
- **标准 dsh 插件声明**：package.json 的 `dsh.bundle.patch`（UI 插件另需 `dsh.client` + `exports["./client"]`）+ `cordis.patch.yml`（`- insert: [{id, name}]`）。git 分发需解决「拉源码不跑 build」——本屋两条实证路线：`prepare` + allowBuilds（deepseek-vision）或提交 `lib/` 产物（token-dashboard，60 文件入库）。
- **宿主 API 面齐备（token-dashboard 全套实证）**：`session/event` 四模式事件、`ctx.slots` UI 槽位（sidebar/shell.overlay/settings）、`ctx.webServer.register` 路由、`ctx.settings` + `$DSH_HOME/settings.yaml` 热重载、`llm.resolveModelInfo().inputModalities` 能力门控、Node Worker + node:sqlite 持久化。
- **版本兼容**：官方无 engines 机制，README 明言「THERE WILL BE COMPATIBILITY-BREAKING CHANGES」；本屋标准 = peerDeps 全量 pin（`^0.1.0-rc.6`）+ README 注明。
- **未查到**：git 分发的分支/tag 约定、私有仓库支持——官方均无文档；官方引用的范本仓库 turtle-ui 当前 404。
- 报告末附「标准插件仓最小文件集（10 项交集）」、成熟版增量清单，以及对 dsh-gui 的双身份脚手架建议（Electron 壳 + IPC fetch carrier + 聚合既有插件）。
