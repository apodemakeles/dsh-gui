# Wayfinder Map · dsh-gui 脚手架与规范

Label: wayfinder:map

## Destination

dsh-gui 仓库的脚手架与规范**落地**：开源标准文件、目录结构、分支策略、忽略清单、CI 骨架、AGENTS.md 全部就位并完成初始提交——下一次会话可以直接开始应用开发。应用本身的功能设计/UI 设计不在本图范围内。

## Notes

- 领域：DeepSeek Harness（dsh，github.com/deepseek-ai/deepseek-harness）的桌面端 GUI，聚合作者既有插件（dsh-deepseek-vision / dsh-token-dashboard / dsh-macos-notify），最终形态对标 codex / zcode 那样的桌面 harness。
- **本 effort 携带执行**：末端的 task 票直接创建文件落地，不只是产出决策。
- 决策票（grilling）用 /grilling + /domain-modeling 与用户逐题对谈；研究票（research）用 /research 子代理查一手资料。
- 站内偏好：中文交流；兄弟仓库沿用双语 README（README.md + README.zh.md）惯例；bash 涉及外网先 `export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=http://127.0.0.1:7890`。
- Tracker：local-markdown（本目录）。地图在 `map.md`，票据在 `issues/`。
- 既有资产（本地一手参考）：
  - `/Users/caozheng/github/apodemakeles/dsh-token-dashboard` — 最成熟的已发布 dsh 插件（v0.2.0，GitHub 分发）
  - `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision` — 已发布 dsh 插件（vision 工具 + 设置卡）
  - `/Users/caozheng/github/apodemakeles/agent-connector` — Electron 桌面 Agent 客户端先例（main/preload/renderer/shared）
  - dsh-macos-notify 目前是空目录，忽略

## Decisions so far

<!-- 一行一条已闭环的票：标题链接 + 一句话结论 -->

- [01 · dsh 官方插件规范与桌面宿主能力调研](issues/01-dsh-plugin-standards.md) — 官方无桌面宿主，但架构明文为 Electron 预留座位（web client 包 over IPC fetch）；插件声明 = package.json `dsh.bundle.patch` + `cordis.patch.yml`；无版本兼容机制，本屋 pin peerDeps；宿主 API 面（事件/槽位/路由/设置/门控/Worker）齐备。
- [02 · 开源桌面应用仓库的社区标准调研](issues/02-oss-repo-standards.md) — 沿用本屋惯例（MIT、双语 README、pnpm；deepseek-vision 的 ci.yml/release.yml 可整套抄）；分支模型共识 GitHub Flow 单主干；Electron/Tauri 两套 .gitignore 清单与三档文件集已备。
- [03 · 产品形态与仓库形态](issues/03-form-factor.md) — 双身份定型：`dsh --profile gui` 拉起 Electron 薄壳（file:// 加载官方 web client + IPC fetch carrier），不重写 dsh 功能；既有插件不作设计输入；独立 .app 留作未来选项不堵死；仓库 = pnpm workspace monorepo（apps/ 壳 + packages/ bundle 与功能插件）。
- [04 · 桌面技术栈选型](issues/04-desktop-stack.md) — React（槽位生态锁定，壳渲染层不另起框架）+ electron-vite/electron-builder（照抄 agent-connector：三目标构建、`--mac dir` 打包）+ pnpm/TS/vitest/`typecheck`；更新走 `dsh plugin update`，electron-updater 留给未来 .app。
- [05 · 目录结构方案定稿](issues/05-directory-layout.md) — 单包仓库定型（细化 03：一站式交付，功能模块内嵌 `src/features/`，一个 `apply()` 全注册）；根即 bundle + `src/{index,shell,features}` + `docs/{adr,images}` + 双语 README；`#path:` 子路径安装已实证、留作备用。
- [06 · 分支策略与忽略清单](issues/06-branch-and-ignore.md) — GitHub Flow 宽松版（agent 走短命分支+PR+squash，人可直推琐碎，tag `v*` 发布）+ 轻量约定式提交 + prepare 路线（lib/ 不入库）；.gitignore 定稿；.scratch/ 入库；纪律文本归 AGENTS.md、.github 只放执行器。
- [07 · AGENTS.md 规范内容定稿](issues/07-agents-md-content.md) — 八节大纲定稿（定位/目录导航/领域速览/命令/变更纪律/版本兼容/安全边界/语言文档），中文撰写；验证纪律为建议级（typecheck+test 不设硬门槛）。
- [08 · 骨架落地](issues/08-scaffold-landing.md) — 21 路径落地、验收全绿（install/build/typecheck/test）；修复三处工具链坑（electron-vite 显式 input、tsdown outDir、pnpm allowBuilds 位置）；main 分支初始提交。**目的地达成，地图闭环。**

## Not yet specified

<!-- 已清空：最后一条（.scratch 入库）随 06 号票定案（入库）；八张票全部闭环，地图完成。 -->

## Out of scope

- 应用功能与 UI 的设计、开发——用户明确：目前不开始
- 既有三个插件的实际迁移/改造实施——本图只决定仓库结构是否为它们预留位置
- macOS 签名/公证与自动更新通道的深入策略——属后续应用开发 effort；本图只在 .gitignore 清单与 CI 骨架中为其预留位置
