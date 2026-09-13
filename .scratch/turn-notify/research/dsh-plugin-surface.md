# 调研 · dsh 插件能力面：轮次完成事件、会话名、设置、槽位、路由

> 调研日期：2026-09-13。对应票：`.scratch/turn-notify/issues/02-research-dsh-surface.md`。
> 版本基准：本仓 pin `0.1.5-rc.1`（`node_modules/@deepseek-ai/*` 实测版本号）；官方文档 clone 自 `github.com/deepseek-ai/deepseek-harness` main（`c291e79`，`0.1.5-rc.2`，相邻 rc，逐条核对过与本仓 node_modules 类型声明一致处才引用）。类型声明路径省略前缀 `node_modules/@deepseek-ai/`；pnpm store 内的包路径以 `…/lib/types/*.d.ts` 相对形式给出。
> 引用格式：`文件路径:行号`；官方文档给 GitHub URL（本地镜像 `/tmp/deepseek-harness-015`）。

## TL;DR（六问一句话）

| # | 问题 | 结论 |
|---|------|------|
| 1 | 宿主半区如何订阅轮次完成（含失败） | `ctx.on('session/event', (session, event) => …)`，判 `event.type === 'turn/end'`；失败不是独立事件，是 `turn/end` 的 `reason.kind === 'error'` 变体。0.1.5 宿主半区此面零变化 |
| 2 | 事件里有什么 | `event.data = { turn, reason }`；reason 六变体可区分成败；会话名不在 header 里，宿主经 `ctx.sessionTitle.get(session)` / `foldSessionTitle()` 取 log-backed title，client 经 `useSessions` 的 `displayTitle` |
| 3 | 设置持久化 | 官方面 = settings 命名空间：宿主 `ctx.settings.installSection('turn-notify', schema, …)`，落 `$DSH_HOME/settings.yaml` 热重载；client 设置卡经 `ctx.settingsScope.bind({namespace}).set()` 写回宿主（同一命名空间是两半区的 join key） |
| 4 | 设置卡槽位 | `settings.plugin.item`（keyed，key = 命名空间），`ctx.slots.inject('settings.plugin.item', …) + ctx.slots.register({name, key, locale, inject}, Card)`；全页用 `settings.section`，单行用 `settings.general.item` |
| 5 | client 程序化跳会话 | 可以：client Cordis 服务 `ctx.sessions.open(sessionId)`（id 必须在列表里）；槽位组件另有标准 prop `useSessions` |
| 6 | 触发点倾向 | 判定放宿主半区（成败/粒度/标题权威、不依赖窗口状态），经插件自有 exact route 暴露给 client 半区，由 client 侧判相关性并发通知；备选最简实现 = 纯 client 半区吃 `api-session/status`/`api-session/error` 转发事件，但粒度与失败细节受限 |

---

## Q1 · 轮次完成事件：宿主半区订阅

### 1.1 标准入口：`ctx.on('session/event', …)`

- `session/event` 是 dsh-session 在 Cordis `Events` 上声明的 **emit 模式**域事件：`'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void`，语义是「Post-commit, fire-and-forget append feed」——append 提交后异步广播，listener 异常被 containment（不会让 append 失败）；scope-filtered dispatch（agent-scoped listener 只收经该 agent 进入的会话；插件根 context 的 listener 收全部）。来源：`dsh-session/lib/types/index.d.ts:52-62`。
- 本仓 token-usage 功能模块的实证（自 dsh-token-dashboard v0.2.0 移植）：
  - `src/features/token-usage/host/index.ts:49-53`：`const onEvent = (session, event) => { collector.onEvent(session, event) }` + `const disposeListener = ctx.on('session/event', onEvent)`；
  - 依赖注入 `src/index.ts:47-54`：插件级 `inject = ['clientModules','webServer','connection','sessions','sessionPersistence']`（`sessions` 就是 dsh-session 的 `SessionStore`）。
- 官方文档明说（0.1.5-rc.2 仍如此）：`turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` 是**持久会话事件类型**而非同名 Cordis 事件——观察它们必须听 `session/event` 再看 `event.type`。来源：[docs/user/develop/framework/events.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/framework/events.md) L104-106（镜像 `/tmp/deepseek-harness-015/docs/user/develop/framework/events.md`）。
- 官方 cookbook 的 hook 插件实例就是 `ctx.on('session/event', (_session, event) => …)`（`inject = ['agents','sessions','sessionPersistence']`）；官方 `/loop` 特性明确「on the `turn/end` session event, followup() the next iteration」——`turn/end` 即官方自己的轮次完成信号。来源：[docs/cookbook/extension-cookbook.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.md) L79、L108（镜像同路径）。
- 存档调研印证：`.scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md:109-112`（A4 事件订阅节）。

### 1.2 「一轮处理完成」的判定

- `SessionEventMap['turn/end']`：`{ turn: number; reason: TurnEndReason }`。来源：`dsh-session/lib/types/types.d.ts:260-263`；官方 `docs/subsystems/session.md` L43 同型（"A turn encloses one model-loop execution…" L657）。
- 触达点：宿主半区 listener 里 `if (event.type === 'turn/end') { … }`。每个 turn 一条（含没有进入任何 step 的空 turn——「A turn with no entered step has no step/start or step/end」types.d.ts:253-258 的 turn/start 注释）。
- **失败也是 `turn/end`**，不是独立错误事件（见 Q2）。
- 附带宿主可用的兄弟事件：`session/created` / `session/disposed`（index.d.ts:40-50）、`session/flush`（parallel 模式 durability checkpoint，index.d.ts:63-71；经 `ctx.sessions.flush(session)` 调用，token-usage 以它为落盘屏障）。

### 1.3 0.1.5 remote-events/WebSocket 改动后变了吗

- **宿主半区：没变。** `session/event` 是宿主进程内的 Cordis 事件，与传输层无关。
- **client 半区：传输层变了，插件 API 面没变但语义收窄。** 0.1.5 起远程事件走 WebSocket：API Gateway 拥有 `/api/remote.mux`，`$events` 逻辑流是唯一 generation source。来源：`dsh-client-connection/README.md`（"API Gateway owns the /api/remote.mux WebSocket and its logical streams…"；"The browser uses HTTP POST for Remote unary calls"）。本仓适配记录：`docs/adr/0001-custom-protocol.md` 修订节（L38-47）、commit `981d75b`（"0.1.5 browser auth + WebSocket remote-events"，壳改从 `http://127.0.0.1:<ephemeral>` 加载并代理 upgrade）。
- client 插件不碰裸 WebSocket：官方把宿主事件**按允许清单转发**到 client，`API_REMOTE_FORWARDED_EVENTS` 全集 = `agent-preset/selected, approval/request, api-session/activity, api-session/added, api-session/error, api-session/removed, api-session/status, commands/change, credentials/reference-updated, goal/activation-changed, cordis/request-run(-resolved), cordis/dynamic-package, cordis/dynamic-retract, cordis/inspect-query(-resolved), llm/adapters-updated, settings/document-updated, user-questions/request`。**`session/event` 不在清单里**（太热），第三方插件也不能往清单加（"The one home of this application's forwarded-Host-event allowlist"，双编译面同读一份声明）。来源：pnpm store `dsh-api-remotes@0.1.5-rc.1` 的 `lib/types/remote-events.d.ts`。
- client 侧消费入口：`ctx.remote.$on(event, …)`（允许清单键面）；会话状态另走标准 hooks（`useSessions` 等，见 Q5）。
- 转发事件的**产生点**（宿主转发循环，`dsh-api-session-controller/lib/index.js:2768-2775`，编译产物）：
  - `'api-session/status'` ← Cordis `agent/status`（`ctx.emit("api-session/status", agent.id, status === "running")`）——**agent 粒度**，一次 running 跨越排队的多个 turn；
  - `'api-session/error'` ← Cordis `agent/error`（`ctx.emit("api-session/error", agent.id, errorChain(error))`）——client.js:1960 注释自称 "the outlet for live failures with no turn position"，载荷只有 `(sessionId, message: string)`（`dsh-api-session-controller/lib/types/types.d.ts:571`）。

---

## Q2 · 事件载荷：成败区分与会话名

### 2.1 成败区分：`TurnEndReason` 六变体

来源：`dsh-session/lib/types/types.d.ts:165-201`（`TurnEndReasonMap`）。

| reason.kind | 含义 | 载荷 |
|---|---|---|
| `completed` | 正常结束 | 无 |
| `aborted` | 取消打断在跑的 turn | `reason: TurnEndCancelCause`（user / parent / hook+reason / disposed / legacy） |
| `blocked` | 被阻断 | 无 |
| `error` | **turn 失败** | `error: LlmFailure`（结构化，见下） |
| `max-tokens` | 有 step 撞输出上限（插件可能续跑） | 无 |
| `interrupted` | 崩溃孤儿事后回填的闭合标记——**loop 不会实时 emit**（「The loop never emits this marker live」） | 无 |

- `LlmFailure`（`dsh-llm/lib/types/types.d.ts:26-38`，pnpm store 路径）：`{ message: string; code: string; status?: number; providerRetryAfterMs?: number; requestId?: string }`——「the `LlmError` facts verbatim, or `{ message: errorChain(error), code: 'UNKNOWN' }` flattened from any other error」（types.d.ts:177-186 注释）。通知正文素材充足。
- 判定式：`event.data.reason.kind === 'completed'` → 成功；`=== 'error'` → 失败并可取 `reason.error.message/code/status`。

### 2.2 会话标识与会话名

- `session: Session` 对象：`session.id: SessionId`、`session.header: SessionHeader`。**header 没有 title/name 字段**——只有 `{ version, id, createdAt, cwd?, parentSession?, isSeeded, origin?, delegationDepth?, agentPreset? }`（`dsh-session/lib/types/types.d.ts:58-95`）。子代理会话可经 `header.origin === 'subagent'` 识别（通知过滤点）。
- 会话名的权威来源是 **log-backed title**（`dsh-session-title` 包）：
  1. 服务面：`ctx.sessionTitle: SessionTitleService` → `.get(session): SessionTitleSnapshot | undefined`；`.rename(session, title)` 写 `session/title` 事件（最新者胜、log-only、不进模型面）。来源：pnpm store `dsh-session-title@0.1.5-rc.1` 的 `lib/types/index.d.ts`（Context merge + Service 声明）；官方 [docs/subsystems/session-title.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session-title.md)（"every accepted revision is a `session/title` event, and `foldSessionTitle()` selects the latest"）。该包在 0.1.5-rc.1 位于 `dsh-api-session-controller` 的依赖树内（pnpm store 实存），`title` projection（`titleProjectionDefinition`，key `'title'`）由其挂载。
  2. 纯函数面（不依赖服务挂载）：`foldSessionTitle(events)` 折叠任意 live/persisted log；`fallbackSessionTitle` / `normalizeSessionTitle` 提供确定性回退标题（首条人话 prompt 前几个词）。来源：同上 index.d.ts 导出行（`export { fallbackSessionTitle, normalizeSessionTitle, truncateTitleUtf8 }`、`foldSessionTitle`）。
  3. client 面：列表行 `SessionSummary.displayTitle`——「Human-facing label: durable title, project basename, then session id」（`dsh-api-session-controller/lib/types/client/sessions/service.d.ts:36-37`）；会话内 `useProjection('title')`（projection-store.d.ts）。
- 即：宿主半区在 turn/end 时可拿 `session.id`（必要）+ title（`ctx.sessionTitle.get(session)` 或 `foldSessionTitle(session.snapshotEvents())`，无 title 时用 `fallbackSessionTitle` 或 header.cwd 的 basename）。

---

## Q3 · 开关配置的持久化

### 3.1 官方推荐面：settings 命名空间（两半区一个 join key）

- **宿主半区注册**：`ctx.settings.installSection(ctx, 'turn-notify', Config, ConfigSchema, { base?, setSource, onChange, validate })`——已有 `cordis.yml` 配置入口的插件用它把组合层值垫在 user 层下，且 settings provider 缺席时照常工作；或直接 `ctx.settings.register(ns, schema, { base, applies, validate })` 拿 owner scope。来源：[docs/cookbook/adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-settings-card.md) §1 L11-46；`dsh-settings/lib/types/index.d.ts`（`installSection` / `SettingsScope<T>` = `get()/watch()/update()/replace()`；`SettingsProvider` Context merge `ctx.settings`）。
- **存储**：`dsh-settings-file` provider 把原文档存 `$DSH_HOME/settings.yaml`（`turn-notify:` 段），外部编辑热重载、保留注释、安全合并。来源：`packages/settings/settings-file/README.md` L12、L44（"by default `settings.yaml` under the harness home"）；[docs/subsystems/settings.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/settings.md)（解析序 = schema defaults → registrant `base` → user section）。
- **client 半区写回宿主**：设置卡经 `ctx.settingsScope.bind({ namespace: 'turn-notify' })` 拿 per-namespace scope（读走共享 describe mirror 不打 wire），`scope.set(field, value)` / `unset` / `mutate(ops)` → 序列化写（带 revision fence）→ 宿主 `SettingsController` Remote 命名空间 `settings` 的 `update/replace/mutate` → provider 持久化；写答案折回 mirror，宿主 `scope.watch(cb)` 立即可见。来源：`dsh-client-ui-settings/lib/types/client/settings-scope.d.ts`（`SettingsScopeBinder.bind`、`SettingsScopeController.set/unset/mutate`）、`dsh-api-settings-controller/lib/types/index.d.ts:41-93`（"Every remote read uses `redactSecrets: true`"）、`dsh-client-ui-settings/lib/types/client/settings-mirror.d.ts`（invalidation = `settings/document-updated` + `connection/reset`）。
- 实用语义：`applies: 'restart'` 标记重启生效（默认 `live`）；`role('secret')` 字段永不出网（wire 面强制 redact）——通知开关类布尔/枚举字段无此顾虑。
- **备选面**（何时不用 settings）：token-usage 范本把大数据存自有 SQLite（`$DSH_HOME/data/token-dashboard/usage-v1.sqlite`，`src/features/token-usage/durable/maintenance.ts`），适合投影数据不适合用户偏好；组合层 config（cordis.yml 行内 `config:`）适合部署常量，用户不可编辑。**turn-notify 的「启用 + 每会话/仅失败 + 静默时段」这类用户开关 → settings 命名空间是官方正解。**

### 3.2 client 改动如何到达宿主

一条路，不需要插件自建：`settingsScope.set()` 即写宿主（Q3.1）。两半区**不需要各自持久化**——settings 文档是唯一事实源，宿主 watch、client mirror 各自派生视图。

---

## Q4 · 设置卡槽位与注册 API

- **槽位名：`settings.plugin.item`** —— keyed 槽位，`kind: 'keyed'`、`scope: 'root'`，options 是 `key`（= 设置命名空间）。类型契约：`dsh-client-ui-settings-plugins/lib/types/client/slot-contract.d.ts:16-25`（"one plugin's card inside the configurable-plugins tab, keyed by the settings namespace the card edits… the tab pairs the two without ever learning what the namespace means"）。
- **注册 API**（官方 cookbook 原文，[adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-settings-card.md) §2 L50-70）：

  ```ts
  export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']
  export function apply(ctx: ClientContext): void {
    const card = new MyPluginCardController(ctx.settingsScope.bind({ namespace: 'my-plugin' }))
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'my-plugin',            // = 宿主 settings 命名空间
      locale: 'settings.myPlugin',
      inject: () => card.inject(),
    }, MyPluginCard))
  }
  ```

- 自动配对：Plugins tab 枚举 Host serve 的命名空间、按 key dispatch 卡片；Host 半区在场才有卡，无卡的命名空间不渲染（cookbook §3 L76-78；`dsh-client-ui-settings-plugins/lib/types/client/ConfigurablePluginsTab.d.ts`）。
- 0.1.5-rc.1 的完整 settings 槽位族（`dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:11-119` 的 SlotMap）：`settings.trigger` / `settings.header` / `settings.action` / `settings.close` / **`settings.section`**（一整页，list，owner 给 `close()`）/ `settings.plugins.tab`（Plugins 区一整个 tab）/ `settings.onboarding` / **`settings.general.item`**（General 区单行偏好）。turn-notify 若只做开关 + 少量选项，`settings.plugin.item` 卡即可；要独立页才用 `settings.section`。
- 本屋实证：
  - dsh-deepseek-vision `src/client/index.ts:31-36`：`ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', id: 'dsh-deepseek-vision', order: 95, locale: 'vision' }, VisionCard))`——注意 vision 是 rc.6 时代写法（键名 `id`），rc.1 类型契约为 `key`，接线时以 slot-contract.d.ts 为准；
  - token-usage（槽位注册形状范本，非设置卡）：`src/features/token-usage/client/index.ts:36-61`——`ctx.slots.inject('sidebar.footer.action', …) + ctx.slots.register({ name, id, order, locale }, FooterTokenEntry)` 与 `shell.overlay` 同构。
- 槽位组件拿到的基础设施：`GlobalStandardProps`（含 `useSessions`）+ `PropsLocale`（`t` 查表）。来源：`dsh-client-ui-session/lib/types/client/index.d.ts:34-40`；本仓 `src/client/client-context.ts:36-41`（结构面）。

---

## Q5 · client 半区程序化跳转指定会话

- **可以。** client Cordis 服务 `ctx.sessions: ISessions`（`dsh-api-session-controller/lib/types/client/index.d.ts:17-22` Context merge；inject 名就是 `'sessions'`）：
  - `open(id: SessionId): void` —— "Select a session as current. **id must exist in the list; unknown ids fail loud**"（`lib/types/client/contract/sessions.d.ts` ISessions 契约注释）；写的是持久化 selection（reload 后仍在），staging 打开该会话的事件窗口（`lib/types/client/sessions/service.d.ts:152-156, 126-133`）。
  - 配套：`list: ObservableSnapshot<SessionListState>`（`byId[id].displayTitle/running/completed`、`current`）、`openSubagent(address)`、`clear()`、`search()`、`refresh()`。
  - 注入实证：dsh-deepseek-vision 的 client 半区 `export const inject = ['slots', 'locale', 'conversation', 'modelDirectories', 'sessions']`（`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/client/index.ts:11`）——本屋已有插件 client 半区注入 `sessions` 的先例。
- 槽位组件（不走 inject）也可经标准 prop `useSessions` 读列表与当前选中（`GlobalStandardProps.useSessions`，`dsh-client-ui-session/lib/types/client/index.d.ts:34-40`）。
- **点击通知跳会话的可行接线**：通知点击发生在 Electron 层（main 的 `notification.on('click')` 或 renderer 的 `notification.onclick`）→ 通知携带 `sessionId` → 送达 client 半区（preload 暴露的桥或 renderer 直接处理）→ `ctx.sessions.open(sessionId)`。约束：目标会话必须在 client 的列表快照里（Host 列表内的会话天然满足；被折叠的 subagent 要走 `openSubagent`）。
- 反向通道（宿主→client 指令）官方未提供通配转发（Q1.3 允许清单不可扩展），若由宿主半区驱动跳转需插件自有通道：exact GET 路由轮询（token-usage 先例：`ctx.webServer.register({ kind: 'exact', path: '/api/token-dashboard/snapshot', … })`，`src/features/token-usage/durable/snapshot-route.ts:46-48`；壳侧分发优先级见 ADR 0002「精确路由表优先的 /api 分发」）或插件自有 WebSocket upgrade 路由（宿主 `ctx.webServer` 有 upgradeRoutes 表 `src/index.ts:107-115`，壳把所有 `/api` 前缀 upgrade 代理到宿主 `src/shell/main/http-surface.ts:47-53`，路由级可行但无先例）。

---

## Q6 · 结论：通知触发点放宿主半区还是 client 半区

### 双方能力对照

| 能力 | 宿主半区 | client 半区 |
|---|---|---|
| 轮次完成信号 | `turn/end` 每 turn 一条（含排队 turn 的边界） | 仅 `api-session/status` running true→false 边沿（agent 粒度，跨 turn 合并） |
| 成败区分 | `reason.kind` 六变体 + `LlmFailure{message,code,status}` | `api-session/error` 只有 `(sessionId, message: string)`，且语义是 agent 级失败（"no turn position"）；`SessionSnapshot.lastAgentError` 仅对已打开会话 |
| 覆盖会话 | 全部（含未选中、后台、CLI 产生的） | 列表快照内的会话（`completed` 提醒位只对非选中会话 armed，见 `SessionManager.syncCompletedNotifications`，`manager.d.ts:270-277`；`SessionListEntry.completed`，`lineage.d.ts:24-25`） |
| 会话名 | `ctx.sessionTitle.get()` / `foldSessionTitle()` / `fallbackSessionTitle` | `useSessions` → `displayTitle`（现成） |
| 窗口状态依赖 | 无（宿主进程常在，窗口最小化/重载照常收事件） | React 树挂着才有；页面重载期间事件不丢（gateway 重放 baseline）但瞬时不消费 |
| 用户相关性判断 | 无（不知道用户在看哪个会话/窗口是否聚焦） | 有（`list.current` 选中态、`document.visibilityState`）——官方 done 提醒的「非选中才提醒」语义在这里 |
| 到 OS 通知的距离 | 远：宿主(dsh 进程)与 Electron 之间只有 session.json 握手 + unix HTTP 面（`src/host/spawn-shell.ts:14-35`），无宿主→main 推送通道 | 近：renderer 的 HTML5 Notification 桥到 OS（形态由 03 票定） |

### 初步倾向：判定在宿主，触发/呈现放 client（混合）

1. **「是否完成、成败、标题」的判定放宿主半区**：`turn/end` 的 reason 粒度与 LlmFailure 细节只在宿主有；后台/未选中会话与窗口隐藏场景下宿主是唯一可靠观察点。
2. **判定结果经插件自有 exact route 暴露**（`GET /api/turn-notify/notifications`，token-usage snapshot 的注册形状；轮询起步，后续可升级 SSE/upgrade route），client 半区半区拉取。
3. **「要不要打扰用户」的相关性判断与 Notification 发出放 client 半区**：选中态（`useSessions.current`）与官方「非选中才提醒」语义、页面可见性都在 renderer；通知点击就地 `ctx.sessions.open(sessionId)` 跳会话（Q5）。
4. **备选（prototype 最短路）**：纯 client 半区吃转发事件——`ctx.remote.$on('api-session/status')` running 下降沿 + `$on('api-session/error')`——零自定义通道即可出通知；代价是排队消息间的 turn 完成不可分辨、失败只有 string。适合 05 号原型票先行验证通知链路，再迁宿主判定。
5. 两个设计约束提醒：子代理会话应按 `session.header.origin !== 'subagent'` 过滤（宿主侧）；开关配置走 settings 命名空间 `turn-notify`（Q3），设置卡进 `settings.plugin.item`（Q4）。

---

## 来源清单

**本仓源码**
- `src/index.ts:47-54`（插件 inject：sessions/sessionPersistence）、`:56-60`（功能模块注册）、`:89-115`（unix carrier 分发 + upgrade 路由表）
- `src/client/index.ts`（client 组合入口，inject `['slots','locale']`）；`src/client/client-context.ts`（client 槽位/字典结构面）
- `src/features/token-usage/host/index.ts:49-53`（`ctx.on('session/event')` 实证）
- `src/features/token-usage/client/index.ts:36-61`（槽位注册形状）；`src/features/token-usage/durable/snapshot-route.ts:46-48`（exact 路由先例）
- `src/host/spawn-shell.ts`（宿主→Electron 仅有 session.json + stdio inherit）；`src/shell/main/http-surface.ts:47-53,114-133`（/api 与 upgrade 全量代理）
- `docs/adr/0001-custom-protocol.md`（修订节 L38-47：0.1.5 WebSocket + browser auth）；`docs/adr/0002-feature-module-client-half.md`
- `.scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md:104-147`（A4 宿主 API 面存档）

**node_modules 类型声明（0.1.5-rc.1，权威 API 面）**
- `dsh-session/lib/types/types.d.ts:58-95`（SessionHeader 无 title）、`:165-201`（TurnEndReasonMap）、`:249-263`（turn/start、turn/end）、`:460-483`（SessionEvent 信封）
- `dsh-session/lib/types/index.d.ts:24-73`（`session/event|created|disposed|flush` Cordis 事件）、`:311-442`（SessionStore：get/list/flush/fork）
- pnpm store `dsh-llm@0.1.5-rc.1` `lib/types/types.d.ts:26-38`（LlmFailure）
- `dsh-api-session-controller/lib/types/types.d.ts:145-154`（host SessionSummary）、`:557,571`（api-session/status、api-session/error 签名）
- `dsh-api-session-controller/lib/types/client/index.d.ts:17-24`（client `ctx.sessions` merge）；`client/contract/sessions.d.ts`（ISessions.open 契约）；`client/sessions/service.d.ts:32-79,152-156`（SessionSummary.displayTitle、SessionListState、open）；`client/sessions/manager.d.ts:45-110,270-277`（select、completedNotifications、syncCompletedNotifications）；`client/sessions/lineage.d.ts:4-37`（TitledSessionSummary、SessionListEntry.completed）；`client/contract/snapshot.d.ts:64-94`（SessionSnapshot.lastAgentError）；`remote-events.d.ts`（SessionControllerRemoteEvent 五元组）
- pnpm store `dsh-api-remotes@0.1.5-rc.1` `lib/types/remote-events.d.ts`（API_REMOTE_FORWARDED_EVENTS 允许清单，无 session/event）
- pnpm store `dsh-session-title@0.1.5-rc.1` `lib/types/index.d.ts`（SessionTitleService.get/rename、foldSessionTitle、fallbackSessionTitle、titleProjectionDefinition、`session/title` 事件）
- `dsh-settings/lib/types/index.d.ts`（SettingsProvider.register/installSection、SettingsScope.get/watch/update/replace）
- `dsh-api-settings-controller/lib/types/index.d.ts:41-109`（SettingsController：describe/update/replace/mutate，redactSecrets 强制）
- `dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:11-119`（settings 槽位族）、`client/settings-scope.d.ts`（SettingsScopeBinder.bind）、`client/settings-mirror.d.ts`（describe mirror + invalidation）
- `dsh-client-ui-settings-plugins/lib/types/client/slot-contract.d.ts`（`settings.plugin.item` keyed 契约）、`client/ConfigurablePluginsTab.d.ts`
- `dsh-client-ui-session/lib/types/client/index.d.ts:34-40`（GlobalStandardProps.useSessions）
- `dsh-client-connection/README.md`（/api/remote.mux WebSocket、$events generation、browser auth）
- `dsh-api-session-controller/lib/index.js:2768-2775`（api-session/status、api-session/error 的产生点，编译产物）

**官方文档（deepseek-harness main@c291e79 = 0.1.5-rc.2，镜像 /tmp/deepseek-harness-015）**
- 插件教程：[docs/user/develop/basic/index.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/index.md)
- 事件系统：[docs/user/develop/framework/events.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/framework/events.md) L104-106（turn/* 是 session 事件类型，listen `session/event` 看 `event.type`）
- 扩展 cookbook：[docs/cookbook/extension-cookbook.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.md) L70-84（session/event hook 实例）、L108（/loop 用 turn/end）
- 设置卡 cookbook：[docs/cookbook/adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-settings-card.md) §1-§3（installSection + settings.plugin.item + settingsScope 全配方）
- 子系统：[docs/subsystems/settings.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/settings.md)、[docs/subsystems/session.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session.md) L43/L657（turn/end、flush 屏障）、[docs/subsystems/session-title.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session-title.md)（log-backed title、foldSessionTitle）
- settings-file README（`$DSH_HOME/settings.yaml` 默认路径、热重载）：packages/settings/settings-file/README.md

**本屋范本插件**
- `/Users/caozheng/github/apodemakeles/dsh-token-dashboard/src/index.ts`、`src/client/index.ts`（双半区 + session/event + 槽位实证；设置不用 settings 命名空间而用自有 SQLite 的反例）
- `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/src/client/index.ts:11,31-36`（client inject `'sessions'` 先例 + settings.plugin.item 注册；rc.6 时代键名 `id` 与 rc.1 `key` 的漂移注意点）、`src/routes.ts`（settings 服务宿主侧读写的旧路径）
