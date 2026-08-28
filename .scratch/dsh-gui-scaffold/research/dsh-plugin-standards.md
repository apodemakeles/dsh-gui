# 调研 · dsh 官方插件规范与桌面宿主能力

> 调研日期：2026-08-21。官方仓库以当日 `main`（commit `141eb6f`，`0.1.0-rc.8`）为准，克隆于 `/tmp/deepseek-harness`。
> 引用格式：官方文档同时给出 GitHub URL 与 `/tmp/deepseek-harness` 本地路径；本屋仓库直接给本地绝对路径。

## TL;DR

1. dsh 插件 = 一个导出 `apply(ctx)` 的 ESM 模块；发布单位是 **bundle**（npm/git 包，package.json 里 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`），运行单位是 **profile**（`$DSH_HOME/profiles/<name>`，由 `dsh plugin` 维护，用户不手写）。
2. UI 插件是**双半区包**：host 半区（`exports["."]`，Node 进程）+ client 半区（`exports["./client"]` + package.json `dsh.client` 声明，浏览器侧槽位注册）。浏览器侧入口不是普通 ESM，是 `window.__ModuleLoader__.load({id, factory})` 闭包工厂包。
3. `--profile <name>` 是组合名不是宿主类型；官方只出厂 `web` 和 `headless` 两个 profile 模板，`tui` 靠第三方 bundle（turtle-ui）自建。**没有官方桌面/desktop profile 或 Electron App**，但架构在多处显式为 Electron 壳预留了座位（IPC fetch carrier、`area/web` 标签覆盖 Electron、目录选择器 native 交互留给 Electron 提供者）。
4. `dsh plugin add github:owner/repo` 拉的是**源码**不跑 build：作者要么带自包含 `prepare` 脚本（用户需 pnpm≥10 `allowBuilds` 授权），要么提交构建产物/发 npm/发 tarball。本屋两种策略都有实例（vision 用 `prepare`，token-dashboard 直接提交 `lib/`）。
5. 宿主 API 面齐备：事件（`ctx.on('session/event')` 等 emit/bail/serial/waterfall 四模式）、UI 槽位（`ctx.slots.register`，`sidebar.footer.action`、`shell.overlay`、`settings.plugin.item` 等）、HTTP 路由（`ctx.webServer.register`）、用户设置（`ctx.settings` + `$DSH_HOME/settings.yaml` 热重载）、能力门控（`llm.resolveModelInfo().inputModalities`）、Node Worker + `node:sqlite` 持久化（token-dashboard 全套实证）。
6. 版本兼容**没有 engines 式机制**：README 明言 developer preview「THERE WILL BE COMPATIBILITY-BREAKING CHANGES」；官方包内部用 peerDependencies 锁同版本；社区实践是 peerDependencies 全量 pin `^0.1.0-rc.6` + README 注明所需 dsh 版本。RPC 层明确「无协议版本，client 与 host 同仓同发；独立发布的客户端出现时再引入」。
7. 本屋标准插件仓最小集（两个已发布仓库的并集）：`package.json`（dsh.bundle + dsh.client + exports 双入口 + files）、`cordis.patch.yml`、`src/index.ts` + `src/client/index.ts`、`tsdown.config.ts`、`tsconfig.json`、`README.md`+`README.zh.md`、`LICENSE`、`.gitignore`；成熟版再加 `test/`、`docs/`、`CONTEXT.md`（术语表）、`README.i18n.yaml`（双语一致性哈希）、`.github/workflows/{ci,release}.yml`。
8. 构建工具链统一 **tsdown**（非 vite）+ vitest + pnpm；CI 三件套 `typecheck/build/test`；发布走 tag `v*` 触发 GitHub Release，npm 可选（两个插件都未发 npm）。
9. agent-connector 是可直接复用的 Electron 壳范本：electron-vite（main/preload/renderer 三段）+ electron-builder（`dir` 目标、`release/` 输出）+ React 渲染进程 + main 进程 SQLite/Provider 注册表；用 npm 不用 pnpm。
10. 对 dsh-gui 的直接含义：做一个「桌面壳 profile（自建 bundle + Electron 载体）+ 复用 dsh web 客户端包 + 沿用既有插件生态」在官方架构叙事内是被预期、被预留的路径（「a future Electron application reuses the same web client packages over an IPC fetch carrier」），但官方自己还没写这个壳，RPC 层也还没有协议版本号，跨版本兼容要靠自己 pin 版本。

---

## A. 官方插件体系

### A1. 插件如何声明自己

**插件模块层**（官方文档明说）：

- 插件是导出 `apply` 函数的 TypeScript 模块，可配 `name` 与 `inject`（依赖服务列表）；另有对象形态和 `Service` 子类形态。注册的一切（事件、工具、定时器）随插件卸载自动清理，显式清理用 `ctx.effect()`。
  来源：[docs/user/develop/basic/index.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/index.md)（本地 `/tmp/deepseek-harness/docs/user/develop/basic/index.md`）
- 配置：导出同名 `Config` 接口 + Schemastery schema（默认值写在 schema 上），加载时校验并填默认值；设计原则「任何两个部署可能不同的值必须是配置字段」；配置编辑触发 HMR 热替换插件。
  来源：[docs/user/develop/basic/config.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/config.md)

**包/manifest 层**（官方文档明说）：

- 两个概念两种 manifest：**bundle** 是携带配置层的 npm 包（`package.json` 里 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`）；**profile** 是 `$DSH_HOME/profiles/<name>` 下描述一次可运行组合的目录（`dsh.profile.bundles` 有序列表），由 `dsh plugin` 自动创建维护，用户不手写。「Nothing is both.」
  来源：[docs/user/develop/basic/publish.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.md) § Two concepts, two manifests
- 最小 bundle 结构（官方教程原文）：

  ```
  hello-plugin/
  ├── package.json       # 声明 dsh.bundle
  ├── cordis.patch.yml   # 层内容：插件行
  └── index.js           # 插件入口
  ```

  `cordis.patch.yml` 是 YAML 数组，如 `- insert: [{ id: hello, name: dsh-hello-plugin }]`；行按 `id` 被后续层整行覆盖（替换整个 `config`，不深合并）。
  来源：同上 publish.md § The bundle manifest
- 没有 `dsh.bundle` 声明的包也能装，但只作为普通依赖：`dsh plugin` 打一次警告、不激活任何层（适合做「插件包 import 的库」）。
  来源：publish.md 同节
- **浏览器半区**声明：package.json 加 `"dsh": { "client": { "platform": "web", "inject": [...], ... } }`，并把构建产物挂到 `exports["./client"]`；host 侧 `dsh-client-modules` 扫描 Loader 条目中声明 `dsh.client` 的包，组成 `window.__DSH_BOOT__` 引导图，bundle 从 `/plugins/<id>/client.js` 提供。
  来源：[docs/subsystems/client-modules.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/client-modules.md) § The scan；实现在 `/tmp/deepseek-harness/packages/client/modules`
- 入口点约定（从官方仓内包与范本推断的稳定惯例，非文档逐字）：host 半区 `main`/`exports["."]` → `lib/index.js`；client 半区 `exports["./client"]` → `lib/client.js`；类型走 `lib/types`。官方例证：`/tmp/deepseek-harness/packages/subagent/subagent-codex/package.json`（`files` 含 `cordis.patch.yml`）。
- 官方教程给的双半区范本是 `packages/client/ui-theme`；设置卡打包范本见 cookbook。
  来源：[docs/cookbook/adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-settings-card.md) § Packaging
- **`prepare` 构建约定**（官方文档明说，针对 git 分发）：git 安装只取源码、不跑 `build` 脚本；作者必须提供 pnpm 在 git 安装后自动运行的 `prepare`，且必须自包含（不假设 monorepo 邻居存在）；官方点名的可运行示例是 turtle-ui（`prepare` 跑专用 tsdown 配置、无项目引用、无类型检查）。
  来源：publish.md § Installing from GitHub: the build-script catch

### A2. profile 机制与桌面宿主

**profile 语义**（官方文档明说）：

- `dsh --profile <name>` 启动 `$DSH_HOME/profiles/<name>` 的组合；`--profile web` 的意思是「名为 web 的那套插件组合」，不是「web 宿主类型」。`dsh web` 是 `--profile web` 的硬编码别名。
  来源：[apps/cli/reference/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/apps/cli/reference/README.md) § Profile boot / Web alias
- **出厂 profile 只有 `web`（base + web-app）与 `headless`（base + headless）**，首次使用从模板自动初始化；其他任何名字的缺失 profile 会报错并提示 `dsh plugin --profile <name> add <package>`——即自定义 profile 是一等公民但要自己装 bundle。
  来源：同上 § Profile boot
- 文档演示的自定义 profile 例子是 TUI：`dsh plugin --profile tui add github:deepseek-harness/turtle-ui`。注意：该 URL 的 org 是 `deepseek-harness`（不是 `deepseek-ai`），且**截至 2026-08-21 该仓库公开访问 404**（`gh repo view deepseek-harness/turtle-ui` 与 `deepseek-ai/turtle-ui` 均不存在）——官方文档引用了一个当前不可公开访问的仓库，turtle-ui 细节无法核实。
  来源：apps/cli/reference § Plugin management（本地 `/tmp/deepseek-harness/apps/cli/reference/README.md` L57-61）+ 本次 gh 实测
- 配置层序（后层胜，按行整行覆盖）：① profile manifest `dsh.profile.bundles` 列表顺序的各 bundle patch（`@deepseek-ai/dsh-base` 恒为首位）→ ② profile 自带 `cordis.patch.yml` → ③ `$DSH_HOME/cordis.patch.yml`（机器级）→ ④ argv 里的 `--patch` 逐个叠加。`--dump-config`/`--dump-default-config` 可免启动检查合成树。
  来源：publish.md § The loading order + cli reference § Profile boot
- app 参数不是 patch 层：定义了可运行 app 的 bundle 挂一个普通 provider 插件，`inject = ['cmdlineArgs']` 解析自己的命令行并提供服务；行配置用 `!!js` 表达式读取（`port: !!js ctx.webStartup.port ?? 8080`）。这是「surface bundle 自带命令行」的官方机制——**一个桌面壳 bundle 完全可以用同一机制定义自己的参数**。
  来源：publish.md § Give a surface bundle its own command line

**桌面宿主现状**（区分：官方明说的预留 vs 未查到）：

- **官方没有桌面/desktop/GUI profile，也没有 Electron App**（`apps/` 只有 `cli` 与 `web`；`/tmp/deepseek-harness/apps/` 实测）。
- 但官方架构文档**三处明说为 Electron 预留了座位**：
  1. GUI 分层与 RPC 协议 note（Status: implemented）：设计目标即含「Launching inside Electron with the same Web technologies as `dsh web`」；正文「A future Electron application reuses the same web client packages over an IPC fetch carrier」；carrier 子类表里有一行「IPC bridge subclass (hypothetical example — **no such shell exists**) | an Electron shell | IPC serialization round trip | would swap only doFetch; contract and base class unchanged」；新应用接入清单只有三步（选 fetch 伪装方式→在 `apps/` 下写装配模块→仅当需要 HTTP 才引 webserver）。
     来源：[.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md)（本地 `/tmp/deepseek-harness/.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md`）
  2. webserver 包 README（随包发布的一手文档）：「This server serves browsers only; **Electron loads the built files over `file://` and sends fetch requests through an IPC bridge instead of this server**.」
     来源：[packages/host/webserver/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/host/webserver/README.md)
  3. GitHub label 分类学：「`area/web` covers **browser and Electron** graphical interfaces」——官方把 Electron 归入 web GUI 域，且明记「Browser and Electron delivery share one graphical domain」。
     来源：[.agents/notes/implemented/process/2026-08-08-unified-github-label-taxonomy.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/.agents/notes/implemented/process/2026-08-08-unified-github-label-taxonomy.md)
- 目录选择器能力缝也点名 Electron：「an Electron shell would provide the `native` interaction through its own dialog API」「a future … Electron provider of the `native` interaction is one dual-face backend package — no gateway surgery」。
  来源：[.agents/notes/implemented/architecture/2026-07-28-directory-picker-capability-seam.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/.agents/notes/implemented/architecture/2026-07-28-directory-picker-capability-seam.md)
- **issue/roadmap 检索**：`gh search issues` 与 issues API 搜 `electron`、`desktop` 在 deepseek-ai/deepseek-harness 均无结果；仓库无 ROADMAP.md（API 404）；issue labels 为通用集（bug/enhancement/...），无 gui/desktop 专项标签。结论：**没有公开的桌面宿主 roadmap 条目**（未查到 ≠ 没有计划，但无公开承诺）。
  来源：本次 `gh api search/issues`、`gh api repos/.../labels` 实测（2026-08-21）

### A3. `github:` 分发对仓库结构的硬性要求

（官方文档明说的部分）

- 包必须是合法 npm/pnpm 可装的 git 仓库：根有 `package.json`，声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，patch 文件真实存在并在 `files` 里（git 安装以仓库文件为准，`files` 主要影响 npm/tarball）。
  来源：publish.md § The bundle manifest + § Plugin management（cli reference：「each dependency resolving to a package whose manifest declares `"dsh": {"bundle": {"patch": "./cordis.patch.yml"}}` joins the layer stack」）
- **git 安装 = 拉 sources，不跑 `build`**。可选三条路：
  1. 作者带自包含 `prepare`（pnpm git 安装后会跑）→ 用户首次 `add` 会因 pnpm ≥10 默认拒绝执行 git 依赖构建脚本而失败，需把 pnpm 打印的包 key 抄进 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds` 再重跑 `add`。官方强调这是「在你机器上于安装期执行该包代码的授权」，建议 pin commit（`github:you/repo#<sha>`）。
  2. 发布到 npm（`pnpm publish` 时已构建 `lib/`）→ `dsh plugin add your-package` 直接装预构建产物，零授权。
  3. `pnpm pack` 出 tarball → `dsh plugin add ./x-y-z.tgz`，零授权。
  来源：publish.md § Installing from GitHub: the build-script catch；cli reference § Plugin management
- 分支/tag 约定：**未查到**官方对分支/tag 的硬性要求（仅支持 `#<sha>`/常规 npm git spec 语法；默认装 HEAD）。无 tag 语义（tag 只影响 npm version 发布，与 git 安装无关）。
- 私有 vs 公开：**未查到**官方文档对私有仓库的说明（教程只演示公开 `github:`；底层是 pnpm 的 git 依赖，私有能力取决于 pnpm/git 凭据，属推断不是官方承诺）。
- `dsh plugin --profile <name> <args...>` 原样转发 pnpm（add/remove/why/update 等全部可用），相对路径锚定调用目录；每次成功运行后把 `dsh.profile.bundles` 与已装状态对账（`update` 拿到声明也会激活层）。**改 bundle 成员需重启 profile**；profile/home 两级 `cordis.patch.yml` 的普通编辑走热重载。
  来源：cli reference § Plugin management

### A4. 插件的宿主 API 面

**事件订阅**（官方文档明说）：

- Cordis 事件四模式：`emit`（广播）、`bail`（短路）、`serial`（顺序 await）、`waterfall`（管线，listener 必须调 `next()`）。监听器是 effect，随插件卸载自动移除。
  来源：[docs/user/develop/framework/events.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/framework/events.md)
- 会话观察的标准入口是 `ctx.on('session/event', ...)`；`turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` 是**持久会话事件类型**而非同名 Cordis 事件，要经 `session/event` 看 `event.type`。Cordis 域事件含 `agent/step`、`agent/request`、`tools/result`、`tools/pre-execute`（权限门 waterfall 扩展点）等。
  来源：events.md § Cordis events and session records；[docs/cookbook/extension-cookbook.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.md) § A hook plugin
- UI 插件官方形态：从 `session/event` 流渲染（`assistant/chunk` 即 token 流），输入经 `agent.followup()`/`agent.steer()` 回注。
  来源：extension-cookbook.md § A UI plugin

**UI 注册（侧栏/面板/设置卡）**（官方文档 + 本屋实证）：

- 浏览器侧一切 UI 经**槽位系统**（`dsh-client-ui-slots`）：`ctx.slots.register({ name, id, order?, locale?, ... }, Component)`；声明感知注入用 `ctx.slots.inject(slotName, () => {...})`。已知槽位：`sidebar.footer.action`（侧栏底部位）、`shell.overlay`（全帧面板）、`settings.plugin.item`（设置页插件卡）、`sidebar.brand.mark/name`、`sidebar.workspaces`、`sidebar.settings` 等。
  来源：`/tmp/deepseek-harness/packages/client/ui-sidebar/README.md`；cookbook adding-a-settings-card § 2；本屋实证 `/Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/client/index.ts`（注册 `sidebar.footer.action` + `shell.overlay`）
- 设置卡官方路径：host 半区 `installSettingsSection(ctx, NS, Config, config, {...})` 注册命名空间；浏览器半区在 `settings.plugin.item` 槽位注册卡，经 `ctx.settingsScope` 读写。Host 只在对应命名空间被服务时卡才渲染。
  来源：[docs/cookbook/adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-settings-card.md)
- 会话内内容节点：注册 `ConversationNodeDefinition` + keyed Chat renderer（往内置 Web 客户端的对话流里加业务行）。
  来源：[docs/cookbook/adding-a-conversation-node.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-conversation-node.md)
- client bundle 形态约束：浏览器半区**不是普通 ESM**——shell 以 classic script 执行并期望 `window.__ModuleLoader__.load({id, factory})` 自注册；宿主共享的 React/cordis/槽位等以 externals 白名单冻结在模块表里，白名单外的依赖必须内联。本屋 tsdown 配置即按此实现（cjs + banner/intro/footer 包装）。
  来源（推断自源码+范本）：`/tmp/deepseek-harness/packages/client/modules`（机制）；`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/tsdown.config.ts`（成品写法与注释）

**HTTP 路由 / Worker / 持久化**：

- `ctx.webServer`（`dsh-host-webserver` 提供）：`register(route)` 加 `exact`/`prefix` 命名路由、`registerUpgrade()` 加 WebSocket 升级路由、`registerFallback()` 独占 SPA 回落、`tapIndex()` 改 index.html；重复路径抛错；返回 disposer。`/api` HTTP 桥与下行 WebSocket 归 connection 插件所有；第三方插件用自有前缀（本屋 dashboard 用 `GET /api/token-dashboard/snapshot`，vision 用自有 `/vision/*` 类路由）。注意：此 server 只服务浏览器；Electron 壳不经它。
  来源：[packages/host/webserver/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/host/webserver/README.md)；实证 `/Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/index.ts`（`inject = ['webServer','sessionPersistence','sessions']`）
- Node Worker 与持久化没有任何官方「插件 Worker API」——就是普通 Node 能力：本屋 dashboard 用 `new Worker(new URL('./usage-worker.js', import.meta.url))` 常驻 Worker + `node:sqlite`，数据落 `$DSH_HOME/data/token-dashboard/usage-v1.sqlite`（0700/0600 权限），并以 `ctx.sessions.flush()` 作为「来源落盘屏障」。官方 dsh 自身也这么用（`dsh-code-runtime-worker-thread`、`dsh-storage-json` 等 bundle 行）。
  来源（范本推断）：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/host/usage-worker.ts`、`tsdown.config.ts`（worker 为独立 entry 必须进发布物）；`/tmp/deepseek-harness/packages/bundle/web-app/cordis.patch.yml`（官方 worker/storage 行）

**能力门控（inputModalities）**（官方文档明说 + 本屋实证）：

- 模型目录（`LlmModelInfo`）带可选 `inputModalities?: readonly ModelModality[]`——「absent means unknown, while an explicit omission is negative capability」。运行期经 LLM 服务解析。
  来源：[docs/subsystems/llm-streaming.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/llm-streaming.md) L441 附近
- 本屋 vision 的门控实现：`llm.resolveModelInfo(provider, model)` 查 `inputModalities`，再经 `system-prompt/assemble` waterfall 把 `view_image` 工具从组装结果里过滤掉（模型原生支持图像时不给工具）；`enabled: on/off/auto` 覆盖。
  来源：`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/gating.ts`

**`~/.dsh/settings.yaml` 集成**（官方文档明说）：

- 用户设置是单一用户文档、按命名空间分段：解析序 = schema 默认 → 注册方组合 `base` → 用户段。`dsh-settings-file` 提供者把原文档存 `$DSH_HOME/settings.yaml`（默认 `$DSH_HOME` = `~/.dsh`；扩展名可选 yaml/json）并推送外部编辑（热重载）。插件用 `settingsNamespace('my-plugin')` 造命名空间 brand，`update/replace/watch` 读写；`describe({redactSecrets:true})` 是 wire 面强制项（`role('secret')` 字段不出网）。
  来源：[docs/subsystems/settings.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/settings.md)；`/tmp/deepseek-harness/packages/settings/settings-file/README.md`
- base bundle 注释明说：「User-settings document (`$DSH_HOME/settings.yaml`, hot-reloaded): a `llm-deepseek:` … section there overrides the adapter entries … and is what the web Models page writes.」
  来源：`/tmp/deepseek-harness/packages/bundle/base/cordis.patch.yml`
- 本屋实证：vision 设置卡写 `vision:` 节（README 与 `src/routes.ts`）；dashboard 的插件发现研究文档在 `/Users/caozheng/github/apodemakeles/dsh-token-dashboard/docs/dsh-plugin-discovery-research.md`。
- 注意一个时间差：官方 rc.8 文档称设置页 Plugins 区按命名空间自动配对卡；vision（面向 rc.6 实现）源码注释写「the settings apiproxy does not expose third-party namespaces to the browser, so the card … talk to the plugin's own routes」——自动配对机制在 vision 开发当时（rc.6）尚不可用，属官方能力演进，写脚手架时应按目标 dsh 版本核对。
  来源：官方 cookbook（rc.8）vs `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/routes.ts` 头注释

### A5. 版本兼容

- **稳定性总声明**（README 原文）：「DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**」
  来源：[README.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/README.md)（本地 `/tmp/deepseek-harness/README.md` L11）
- **无 dsh 版本的 engines 机制**：manifest 里没有类似 `engines.dsh` 字段；官方教程与 CLI reference 均未提及插件声明 dsh 版本兼容的方式。官方仓内插件用 peerDependencies `workspace:^` 与主仓锁死同版本（如 `@deepseek-ai/dsh-subagent-codex@0.1.0-rc.8` peer 全 `workspace:^`）。
  来源：`/tmp/deepseek-harness/packages/subagent/subagent-codex/package.json`；「未查到 engines.dsh」为穷举官方文档后的结论
- **RPC/协议层无版本**（官方明说）：「No protocol version: client and host release bound together; `host.describe` has no protocolVersion field; **introduce one when an independently released client appears**.」——这句话对 dsh-gui 尤其重要：一个独立发布的桌面客户端正是「触发引入协议版本」的事件。
  来源：GUI layering note § Session semantics
- 根 `engines` 只约束 Node（`^22.19.0 || >=24.0.0`），不约束插件。
  来源：`/tmp/deepseek-harness/package.json`
- 社区（本屋）事实标准：peerDependencies 把用到的 `@deepseek-ai/*` 包全量 pin 到同一 rc（`^0.1.0-rc.6`），README 注明「Requires dsh `0.1.0-rc.x`」。
  来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/package.json`、`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/{package.json,README.md}`

---

## B. 本屋事实标准

### B1. dsh-deepseek-vision（v0.1.0，已发布，轻量范本）

路径：`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision`

- **完整文件清单**（排除 node_modules/lib 构建产物）：
  - `.github/workflows/ci.yml`、`.github/workflows/release.yml`
  - `build/tsdown.client.ts`、`build/web-platform.ts`（client 构建的 externals 白名单抽出）
  - `cordis.patch.yml`、`LICENSE`(MIT)、`package.json`、`pnpm-lock.yaml`
  - `README.md` + `README.zh.md`（双语；**无** README.i18n.yaml、无 CONTEXT.md、无 CHANGELOG）
  - `scripts/accept.mjs`（mock 验收套件，`--live` 连真实 dsh）
  - `src/`（host 半区：index/config/tool/gating/images/vision-call/routes/auto-describe + colocated `*.test.ts`）、`src/client/`（client 半区：index/VisionCard/paste/locale + css）
  - `tsconfig.json`、`tsdown.config.ts`、`.gitignore`
  - `.scratch/vision-plugin/`（issues+research+map 规划文件，**已入 git**）
- **package.json 关键字段**：`dsh.bundle.patch` + `dsh.client`（`inject: ["@deepseek-ai/dsh-client-runtime"]`）；exports 双入口 `.`/`./client`；`prepare: "tsdown"`（git 安装自构建）；`files: ["lib", "cordis.patch.yml"]`；peerDeps pin `^0.1.0-rc.6`；`engines.node >= 20`；运行时依赖仅 `sharp`（图像预处理）；`publishConfig.access public`（虽未发 npm）。
  来源：`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/package.json`
- **README 双语惯例**：英文主文档 + `English | [中文](README.zh.md)` 切换行；Install 一节直接给 `dsh plugin --profile web add github:apodemakeles/dsh-deepseek-vision` 并注明「The plugin builds itself on install (`prepare`)」+「Restart `dsh web` afterwards」。
  来源：`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/README.md`
- **CI**：`ci.yml` = pnpm 装配 + `typecheck` + `build` + `test`（Node 22，frozen lockfile）。
- **发布实践**：`release.yml` 由 tag `v*` 触发，跑同一验证链后用 `softprops/action-gh-release@v2`（`generate_release_notes: true`）出 GitHub Release；注释明说「Distribution is the repository itself (git installs via dsh plugin add); there is no npm publishing (map ticket 16)」。本地 tag 列表当前为空、GitHub 无 release——workflow 就绪但尚未打 tag 发布。
  来源：`.github/workflows/{ci,release}.yml`；`git tag -l` 与 `gh release list` 实测
- **测试**：vitest，`*.test.ts` 与源码同目录 colocated；另有 `pnpm accept` mock 验收。构建：tsdown（host ESM + client cjs 闭包工厂）。

### B2. dsh-token-dashboard（v0.2.0，最成熟范本）

路径：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard`

- **完整文件清单**（排除 node_modules）：
  - 根：`CONTEXT.md`（13835 字节术语表）、`cordis.patch.yml`、`LICENSE`(MIT)、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`README.md`/`README.zh.md`/`README.i18n.yaml`、`tsconfig.json`、`tsdown.config.ts`、`.gitignore`
  - `docs/`：`dev-loop.md`、`dsh-plugin-discovery-research.md`、`durable-usage-architecture.md`、`zcode-token-usage-research.md`、`images/*.png`
  - `src/`：`index.ts`（host 入口）、`cli.ts`（本地运维 CLI：status/verify/rebuild/backups/restore/cleanup）、`core/`、`host/`（day-buckets、usage-fold、usage-worker）、`durable/`（SQLite 投影全家桶：collector/projector/sqlite-store/init-recovery/maintenance/snapshot-route/worker-client/contracts）、`client/`（index/store/panel/*、entry/FooterTokenEntry、styles、locales）
  - `test/`（**独立测试目录**，13 个 `*.test.ts`，含 `plugin-shape.test.ts` 插件形态守卫与 `real-sessions.test.ts`）
  - `lib/`（构建产物，60 个文件**提交进 git**——这是它 GitHub 分发免 prepare/allowBuilds 的机制）
  - `.scratch/dsh-token-dashboard/`、`.scratch/durable-usage-architecture/`（issues/research/map/prototypes，36 个文件入 git）
- **README 惯例**：双语 + README.i18n.yaml；README 头部带 Status 行链接 release；What it does 按 Host half / Client half / CLI 三段描述；Installation 给 `github:` 安装 + 「Then restart dsh web」；Data and operations 一节写明 `$DSH_HOME/data/...` 路径与口径；Known limitations 一节固定存在。
  来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/README.md`
- **README.i18n.yaml 机制**（读文件确证）：记录双语两侧**最后一次确认一致时的 git blob hash**（`git hash-object README.md README.zh.md`），作为「双语等权威、改一侧必须带另一侧」的一致性凭据。官方仓同名文件（如 `README.i18n.yaml`、`docs/*.i18n.yaml`）同构，是官方 doc-sync 体系的一部分。
  来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/README.i18n.yaml`；官方对应 `/tmp/deepseek-harness/README.i18n.yaml`
- **CONTEXT.md 作用**：仓库术语表（「只收录词汇与定义，不放实现细节」）——每个业务概念一条权威定义（usage fact、run epoch、checkpoint、投影背压……），是架构决策的落点。**cordis.patch.yml 的作用**：插件行插入 profile 的激活层（`- insert: [{id: token-dashboard, name: '@apodemakeles/dsh-token-dashboard'}]`，头部注释即安装说明）。
  来源：`CONTEXT.md` 头部；`cordis.patch.yml`
- **package.json 关键字段**：与 vision 同构（dsh.bundle + dsh.client（inject 四包）、双入口 exports、`bin` 挂本地 CLI、peerDeps pin rc.6、tsdown+vitest、`prepublishOnly: pnpm build`），差异：**无 `prepare` 脚本**（靠提交 lib/ 分发）、`engines.node >= 22.5.0`、files 含 `src`、`docs/images/*.png` 与三份 README/LICENSE。`keywords` 含 `dsh-plugin`（供插件发现；v0.2.0 提交「chore: prepare v0.2.0 package discovery metadata」）。
  来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/package.json`
- **pnpm-workspace.yaml 的真实用途**：不是 workspace 包列表，而是 `minimumReleaseAgeExclude`——pnpm 的最小发布年龄安全策略豁免清单（把全部 `@deepseek-ai/*@0.1.0-rc.6` 列入豁免以允许安装新近发布的官方包）。
  来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/pnpm-workspace.yaml`
- **构建**：tsdown 四 entry——`index`（host）、`usage-worker`（常驻 Worker，必须进发布物）、`cli`、`client`（cjs + `window.__ModuleLoader__.load` 闭包工厂包装，CLIENT_EXTERNALS 白名单 + noExternal 内联其余）；类型由 `tsc -b` 另出 `lib/types`。
  来源：`tsdown.config.ts`
- **发布实践**：GitHub Releases 已上线（v0.2.0，2026-08-16，`gh release list` 实测）；tag `v0.1.0`、`v0.2.0`；npm 未发布（README 明说）；**无 .github/ 目录、无 CI workflow、无 CHANGELOG**——发布是手动 tag + Release（提交信息「docs: finalize GitHub-only v0.2.0 release」）。
  来源：`git tag -l`、`gh release list`、目录清单
- **架构文档**：`docs/durable-usage-architecture.md` 是持久化契约全文；`.scratch/*/map.md` 是规划追踪器（issues 番号在源码注释里被反复引用，如「map tickets 14/20」）。

### B3. agent-connector（Electron 桌面壳参考）

路径：`/Users/caozheng/github/apodemakeles/agent-connector`

- **结构**（排除 node_modules/dist/out/release）：
  - `electron.vite.config.ts`（main/preload/renderer 三段配置：main+preload `externalizeDepsPlugin`，renderer React 插件）
  - `src/main/`：`index.ts`（主进程）、`database.ts`(+test)（SQLite 结构化存储）、`providers/`（registry.ts + claude.ts + claude-events.ts + types.ts——Provider 注册表模式，每会话一个子进程，stdin 常开多轮，SIGINT 停止，`--resume` 恢复）
  - `src/preload/index.ts`（allowlisted IPC channels 的 typed 桥）
  - `src/renderer/`：`index.html` + `src/`（App.tsx、main.tsx、icons.tsx、global.d.ts、styles.css）——React 19
  - `src/shared/types.ts`（跨进程类型）
  - `build/icon.{png,svg}`（electron-builder 图标）、`docs/architecture.md`（中文架构文档，含进程/数据流图与 Provider 边界）、`design-qa.md`、`scripts/install-macos.sh`
  - `package.json`、`package-lock.json`（**npm 不是 pnpm**）、`tsconfig.json`、`.gitignore`
- **关键脚本与打包**：`dev` = `electron-vite dev`；`build` = `electron-vite build`；`package:mac` = `npm run build && electron-builder --mac dir --arm64`（只出**目录不出 dmg**）；`electron-builder` 配置内嵌 package.json `build` 段：`appId dev.agentconnector.desktop`、`asar: true`、输出目录 `release/`、`files: ["out/**/*", "package.json"]`、mac target `dir`。
  来源：`/Users/caozheng/github/apodemakeles/agent-connector/package.json`
- **对 dsh-gui 的可借鉴点**：main/preload/renderer/shared 四目录分层 + typed IPC + Provider 注册表 + main 进程 SQLite；`private: true` 未发布；测试 vitest（main 进程 colocated）。
  来源：`docs/architecture.md`（「每个运行中的会话对应一个独立子进程……下次发送消息时使用保存的 session ID 和 --resume 恢复上下文」）

---

## 对后续决策的影响

**1. dsh-gui 做独立桌面 App 在官方体系内是否可行？**

可行，且是被官方架构**预期**的路径，但要认清楚三件事：

- 官方在 GUI 分层 note 中明说「a future Electron application reuses the same web client packages over an IPC fetch carrier」「no such shell exists」——即：**官方自己还没做，官方设计要求新壳 = `apps/` 下一个装配模块 + 一个 `AbstractApiClient` 的 IPC 子类（只换 `doFetch`），不改契约**。webserver README 也确认 Electron 壳应 `file://` 加载 dist、fetch 走 IPC、不复用 HTTP server。
- 接入清单官方给了三步：选 fetch 伪装方式（IPC）→ 在 `apps/` 下写装配模块（`startHost()` + 客户端子类 + 私有信号/退出语义）→ 不需要 HTTP 就不开端口。目录选择器的 `native` 交互被点名留给 Electron 壳用自己的 dialog API 以双半区 backend 包提供。
- 风险同在：README 明言 developer preview 会有破坏性变更；RPC 无协议版本（「独立发布的客户端出现时才引入」——dsh-gui 就是那个独立客户端，短期要靠 pin 精确版本对齐，且每版 dsh 升级都可能要求适配）。

**2. 是否有官方桌面宿主？**

没有。出厂 profile 仅 `web`/`headless`；apps 仅 cli/web；issue 检索无 desktop/electron 条目；无 ROADMAP.md。官方的 GUI 投入全部在浏览器侧（`area/web` 标签同时覆盖 browser 与 Electron，说明官方把「Electron 交付」当作 web GUI 域的延伸而非独立产品线）。dsh-gui 若做 Electron 壳，等于替官方补上那个「hypothetical」座位，官方文档的全部承诺是「契约与基类不用改」。

**3. 一个标准 dsh 插件仓库的最小文件集（本屋事实标准）**

必带（两个已发布仓库的交集，全部有实证）：

```
package.json          # dsh.bundle.patch + (有 UI 则 dsh.client)；exports "." 与 "./client"；
                      # peerDependencies pin 官方包到同一 rc；engines.node；files 含 cordis.patch.yml
cordis.patch.yml      # - insert: [{id, name: '<包名>'}]，头部注释写安装命令
src/index.ts          # host 半区：export name/inject/apply(Config)
src/client/index.ts   # client 半区（纯 host 插件可省）：槽位注册
tsdown.config.ts      # host ESM entry；client cjs + __ModuleLoader__ 闭包工厂包装
tsconfig.json
README.md + README.zh.md   # English | 中文 切换行；Install 给 dsh plugin add 命令
LICENSE               # MIT
.gitignore            # node_modules/ *.tsbuildinfo .DS_Store（.playwright-cli/ 视情况）
```

成熟版增量（token-dashboard 已实证）：`test/` 独立目录 + `plugin-shape.test.ts`、`docs/`（架构契约 + dev-loop + 调研存档）、`CONTEXT.md` 术语表、`README.i18n.yaml` 双语哈希、`.github/workflows/{ci,release}.yml`、常驻 Worker/CLI 作为 tsdown 额外 entry、`bin` 字段挂运维 CLI。

**4. 分发策略二选一（都有本屋实证）**：git 源码 + `prepare`（vision：`files:["lib",...]`，用户需 `allowBuilds`）或提交 `lib/` 构建产物（token-dashboard：零授权、装完即用，代价是仓库里带 60 个构建文件）。npm 发布是官方推荐但本屋尚未启用。

**5. 对脚手架的直接建议**（从证据推出）：dsh-gui 可以按「双身份」组织——既是一个 Electron 壳工程（agent-connector 的 electron-vite 四目录 + electron-builder `dir` 目标），又按官方接入清单实现 IPC fetch 子类装配；插件聚合能力沿用 profile/bundle 机制（`dsh plugin --profile <桌面profile> add ...`），复用 web 客户端包与既有插件（token-dashboard/vision 的槽位 UI 在任何跑 `dsh.client` 模块表的壳里都能出现）。版本策略照抄本屋惯例：peerDeps 全量 pin 单一 rc。

---

## 来源清单

**官方（github.com/deepseek-ai/deepseek-harness，main@141eb6f = 0.1.0-rc.8，本地镜像 /tmp/deepseek-harness）**

- README（developer preview 声明）: https://github.com/deepseek-ai/deepseek-harness/blob/main/README.md
- 插件教程·第一个插件: docs/user/develop/basic/index.md
- 插件教程·配置: docs/user/develop/basic/config.md
- 插件教程·打包与安装（bundle/profile/prepare/allowBuilds/层序）: docs/user/develop/basic/publish.md
- 框架·服务与依赖: docs/user/develop/framework/service.md
- 框架·事件系统: docs/user/develop/framework/events.md
- CLI 行为参考（profile/web 别名/plugin 管理/allowBuilds）: apps/cli/reference/README.md
- 客户端模块系统（dsh.client/__DSH_BOOT__/bundle 路由）: docs/subsystems/client-modules.md
- 用户设置子系统: docs/subsystems/settings.md
- extensions 子系统（动态插件）: docs/subsystems/extensions.md
- LLM 流式（inputModalities）: docs/subsystems/llm-streaming.md
- web-server 子系统（Electron file:// + IPC）: docs/subsystems/web-server.md
- cookbook·设置卡: docs/cookbook/adding-a-settings-card.md
- cookbook·扩展插件形态: docs/cookbook/extension-cookbook.md
- cookbook·会话节点: docs/cookbook/adding-a-conversation-node.md
- Agent Note·GUI 分层与 RPC 协议（Electron 预留/无协议版本/接入清单）: .agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md
- Agent Note·GitHub label 分类学（area/web 覆盖 Electron）: .agents/notes/implemented/process/2026-08-08-unified-github-label-taxonomy.md
- Agent Note·目录选择器能力缝（native 交互留给 Electron）: .agents/notes/implemented/architecture/2026-07-28-directory-picker-capability-seam.md
- webserver 包 README: packages/host/webserver/README.md
- ui-sidebar 包 README（槽位清单）: packages/client/ui-sidebar/README.md
- ui-slots 包 README（槽位系统契约）: packages/client/ui-slots/README.md
- settings-file 包 README（settings.yaml 路径）: packages/settings/settings-file/README.md
- base bundle patch: packages/bundle/base/cordis.patch.yml
- web-app bundle patch: packages/bundle/web-app/cordis.patch.yml
- headless bundle patch: packages/bundle/headless/cordis.patch.yml
- 官方插件包示例（peerDeps workspace:^）: packages/subagent/subagent-codex/package.json
- 根 package.json（engines/node、版本 0.1.0-rc.8）: package.json

**官方侧实测（2026-08-21，经代理）**

- `git clone --depth 1` 成功；`gh search issues electron/desktop` 与 issues API 均无结果；labels 无 gui/desktop；无 ROADMAP.md（404）；`deepseek-harness/turtle-ui` 与 `deepseek-ai/turtle-ui` 仓库均不可访问（官方文档引用的示例仓库当前 404）

**本屋仓库（本地路径）**

- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/package.json
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/.github/workflows/ci.yml
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/.github/workflows/release.yml
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/cordis.patch.yml
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/gating.ts
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/routes.ts
- /Users/caozheng/github/apodemakeles/dsh-deepseek-vision/README.md
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/package.json
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/cordis.patch.yml
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/tsdown.config.ts
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/index.ts
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/client/index.ts
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/CONTEXT.md
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/README.i18n.yaml
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/pnpm-workspace.yaml
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/README.md
- /Users/caozheng/github/apodemakeles/dsh-token-dashboard/docs/dsh-plugin-discovery-research.md
- /Users/caozheng/github/apodemakeles/agent-connector/package.json
- /Users/caozheng/github/apodemakeles/agent-connector/electron.vite.config.ts
- /Users/caozheng/github/apodemakeles/agent-connector/docs/architecture.md

**本屋 git/GitHub 状态实测**

- dsh-token-dashboard：tags v0.1.0、v0.2.0；GitHub Release v0.2.0（2026-08-16）；lib/ 60 个文件入库；.scratch 36 个文件入库；无 .github/、无 CHANGELOG
- dsh-deepseek-vision：无 tag、无 GitHub Release（workflow 就绪）；lib/ 不入库（走 prepare）；.scratch 入库
- agent-connector：private、未发布（package.json `private: true`，无 tag）
