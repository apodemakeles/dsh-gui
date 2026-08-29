# AGENTS.md · dsh-gui

面向 AI 协作 agent 与人类贡献者的仓库说明书。规则细节与决策依据存档于 `.scratch/dsh-gui-scaffold/`（规划地图，其改动随库提交）。

## 1. 项目是什么

dsh（DeepSeek Harness）的桌面壳：**以 dsh 插件（bundle）身份交付的 Electron 应用**。`dsh --profile gui` 拉起宿主 → 本插件启动 Electron 壳 → 壳用 `dsh-gui://` 加载官方 web client（ADR 0001；无 TCP 端口）、fetch 走 IPC fetch carrier——**不重写任何 dsh 核心功能**。单包一站式交付：全部功能模块随一个包安装，用户无按功能选择的粒度。

- 术语表：[CONTEXT.md](CONTEXT.md)（壳、gui profile、dsh-gui bundle、IPC fetch carrier、功能模块）。
- 规划与调研：`.scratch/dsh-gui-scaffold/`（决策历史、两份一手调研）。

## 2. 目录导航

```
├── src/
│   ├── index.ts        # 唯一插件入口：apply() 拉起壳并注册功能模块
│   ├── client/         # 浏览器半区组合入口：所有功能模块的 UI 注册进同一个 client bundle
│   ├── assembly/       # 纯函数：dist 定位、静态路径、Unix HTTP、session JSON（无 Electron / Cordis）
│   ├── host/           # Cordis 半区：静默 webServer、写 session、spawn Electron
│   ├── shell/          # Electron 壳（electron-vite 三目标构建 → out/）
│   │   ├── main/       #   主进程：窗口、自定义协议、生命周期
│   │   ├── preload/    #   页面世界：安装 __DSH_TRANSPORT__
│   │   ├── renderer/   #   pnpm dev 占位页（真实 client 由协议加载）
│   │   └── shared/     #   两侧共用常量/类型
│   └── features/       # 功能模块：一个子功能一个文件夹（host/client 两侧），由 index.ts 统一注册
├── test/               # vitest
├── docs/               # adr/（架构决策记录）+ images/（截图）
├── build/              # 打包资源（icon.icns，入库）
├── scripts/            # 辅助脚本（package-mac.mjs：staging 隔离打包，见 ADR 0003）
├── .github/            # 只放执行器：workflows/ + issue/PR 模板
└── lib/ out/ release/  # 构建产物（不入库）
```

第二 Cordis 入口：`package.json` 的 `exports["./webserver"]`（静默 `webServer` 替身）；浏览器半区入口：`exports["./client"]` + `dsh.client` 声明（闭包工厂 bundle，经 `/plugins/<包名>/client.js` 伺服）。

**新增功能模块**的做法：在 `src/features/<名>/` 建文件夹（宿主侧导出 `applyXxx(ctx)`，浏览器侧导出 `applyXxxClient(ctx)`），宿主侧在 `src/index.ts` 的 `apply()` 里注册、浏览器侧在 `src/client/index.ts` 里注册。不建独立插件包、不新增 dsh.bundle 声明。

## 3. 领域速览（dsh 十分钟入门）

- **三层积木**：plugin（导出 `apply(ctx)` 的模块）→ bundle（npm 包，`package.json` 声明 `dsh.bundle.patch` 指向 `cordis.patch.yml`）→ profile（`~/.dsh/profiles/<name>` 的 bundle 组合清单；`dsh --profile gui` 启动）。
- **槽位系统**：web client 界面上的具名插槽（侧栏、面板、设置卡），插件的 client 半区往槽位注册 React 组件。
- **IPC fetch carrier**：官方 web client 与宿主间的请求全部汇于 `AbstractApiClient.doFetch`；壳只替换该函数。桌面实现里页面同源 fetch 打到 `dsh-gui://`，main 经 Unix socket 交给 `connection.createSharedFetchHandler('/api', toFetchHandler)`（无 TCP 端口）——这是「不重写 dsh 功能」的运输层落点。
- 官方文档：[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `docs/`（插件教程 `docs/user/develop/basic/`、cookbook）。
- 本仓库存档调研：`.scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md`（插件规范逐条带出处）、`oss-repo-standards.md`（社区标准）。
- 本屋成熟插件范本：`dsh-token-dashboard`（双半区、槽位、Worker、发布全流程实证）。

## 4. 常用命令

- **包管理只用 pnpm**（`packageManager` 已锁定版本；禁用 npm/yarn）。

```sh
pnpm dev            # Electron 壳开发（占位窗口，热更新）
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm build          # electron-vite build（out/）+ tsdown（lib/）
pnpm package:mac    # 本地未打包 .app（release/，arm64）；经 scripts/package-mac.mjs 的仓库外 staging 隔离打包，勿绕过该脚本直接跑 electron-builder（会动 lockfile）
```

- bash 涉及外网请求（git clone、下载依赖）前先设代理：

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=http://127.0.0.1:7890
```

## 5. 变更纪律

- **分支**：GitHub Flow 宽松版。main 唯一长命分支；agent 一律短命分支（`agent/`、`feat/`、`fix/` 前缀）→ PR → **squash merge** → 删分支；琐碎修改人可直推 main。
- **提交信息**：约定式前缀 `feat:` / `fix:` / `chore:` / `docs:`（squash 后 main 一条变更一条记录）。
- **验证（建议级）**：声称任务完成前建议跑通 `pnpm typecheck` 与 `pnpm test`。
- **分工**：纪律规则写在本文件；`.github/workflows/` 只放执行器（ci.yml = PR/push 闸口，release.yml = tag 发布）。GitHub 仓库设置层的分支保护（禁 force push、CI 必过）由作者开启，不是仓库文件。

## 6. 版本与兼容

- dsh 相关依赖（`@deepseek-ai/*`、`@deepseek-ai/cordis`）**全量 pin 在同一 rc 版**；**agent 不得自行升级它们**。
- RPC 无协议版本号（官方在「独立客户端出现时才引入」，dsh-gui 就是第一个）——升级 dsh 前，先人工核对官方 CHANGELOG/破坏性变更，再统一调整 pin 并做适配。
- 发布：main 上打 semver tag（`v*`，自 0.1.0 起），release workflow 自动出 GitHub Release + 自动 Release Notes。

## 7. 安全边界

- `.env*`、签名证书（`*.p12` / `*.p8` / `*.cer` / `*.pfx`）、`dev-app-update.yml` **永不入库**（.gitignore 已列）。
- `~/.dsh/` 下的一切（`settings.yaml`、profiles、会话记录、SQLite 数据）视为**用户敏感数据**：不得在日志、回复、测试快照或提交中回显 API key、token 或用户数据。
- `lib/`、`out/`、`release/` 是构建产物不入库（`prepare` 在安装期构建）。

## 8. 语言与文档

- 交流与内部文档用中文；面向用户的文档双语互链（`README.md` 英文 + `README.zh.md` 中文）。
- 新文档进 `docs/`；不可逆且后人费解的架构决策写 `docs/adr/`（编号递增）。
- `.scratch/` 规划文件随库提交，勿清理。
