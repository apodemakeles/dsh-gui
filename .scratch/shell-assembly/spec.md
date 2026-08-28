# Spec · 壳装配（里程碑 1：壳跑起来）

> 本目录是给实现者（人或任何模型）的自包含交接说明。背景决策不在此重复，按引用读。

## 目标

`dsh --profile gui` 拉起 Electron 壳，壳加载**官方 dsh web client**，界面请求经 **IPC fetch carrier** 打回宿主——壳从占位页变成真实 dsh 界面。不重写任何 dsh 核心功能。

## 验收标准

1. `dsh plugin --profile gui add ~/github/apodemakeles/dsh-gui`（本地路径安装）后，`dsh --profile gui` 打开窗口并显示**真实 web client 界面**（至少：会话列表/对话流出现，能发一条消息并收到回复）。
2. `pnpm typecheck` 与 `pnpm test` 绿；PR 的 CI 绿。
3. 官方 web client 的加载不经 HTTP 端口（file:// + IPC 路线，或侦察后论证等价替代并记录 ADR）。

## 必读引用（按序）

1. `AGENTS.md` —— 仓库纪律（分支/提交/验证/安全边界）与领域速览。
2. `CONTEXT.md` —— 术语（壳、gui profile、IPC fetch carrier、功能模块）。
3. `.scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md` —— 一手调研，重点 §A2（官方为 Electron 预留的座位与三步接入清单）、§A4（宿主 API 面）、§A1（bundle/prepare 规则）。
4. 形态决策出处：`.scratch/dsh-gui-scaffold/issues/03-form-factor.md`（Answer）；布局：`05-directory-layout.md`（Answer）。

## 已知事实（省去重新调研）

- 当前骨架：`src/index.ts` 的 `apply()` 是 stub；`src/shell/` 三目标可构建（`pnpm dev` 起占位窗口）；preload 是 carrier 的预留落点。
- 官方叙事（调研 §A2，带出处）：Electron 壳 = `file://` 加载 web client 构建产物 + fetch 走 IPC 桥，**不复用** webserver 的 HTTP 服务；接入清单只有三步（fetch 伪装 → 装配模块 → 不开端口）。
- 引导图机制（调研 §A1/A4）：浏览器场景下宿主扫描带 `dsh.client` 的包生成 `window.__DSH_BOOT__`，插件界面从 `/plugins/<id>/client.js` 取。**file:// 场景下这两件事怎么办没有官方文档**——这是 01 号票的核心未知。
- RPC 无协议版本号：peerDeps pin 纪律见 AGENTS.md §6。
- 本地 dsh：0.1.1-rc.1；官方源码可 `git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness`（读 `apps/web`、`packages/host/webserver`、`packages/client/modules`）。

## 开放问题（01 号票侦察后定，定了写回 issue，重大者补 ADR）

- web client 构建产物在用户机器上的位置如何解析（随 dsh 安装存在于何处？从宿主侧哪个服务拿路径？）。
- 宿主与壳的进程拓扑：Electron 主进程内 `startHost()` vs 宿主独立子进程（官方装配清单含「私有信号/退出语义」，未规定死）。
- `AbstractApiClient` 子类的注入点：官方 web client 的模块加载机制（externals 白名单、`__ModuleLoader__`）允许在哪里替换 doFetch。
