# 02 · research：dsh 插件能力面（事件、设置、槽位、路由）

Type: research
Status: resolved

## Question

turn-notify 的宿主/client 双半区各能触达 dsh 的哪些面？逐条查清，每条带出处（官方文档 / node_modules 类型声明 / dsh-token-dashboard 范本 / 本仓 src）：

1. **轮次完成事件**：功能模块的宿主半区如何订阅「某会话一轮处理完成」（含失败）？dsh 有没有 session/event 订阅 API？`token-usage` 范本与 `.scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md` 里的事件面是什么？0.1.5 的 remote-events/WebSocket 改动后 client 半区收事件的方式变了吗（见 ADR 0001 修订、commit 981d75b）？
2. **事件里有什么**：轮次完成事件/回调能否拿到会话名（或 session id → 会话名的查询路径）？能否区分正常结束与报错？
3. **设置持久化**：功能模块的开关配置该存哪？dsh 是否提供插件配置面（settings.yaml 集成 / storage / 其他）？client 半区设置卡改动如何传回宿主（或各自持久化）？
4. **设置卡槽位**：client 半区往设置区注册卡片的槽位名与注册 API（token-usage 或范本插件实证）。
5. **路由能力**：client 半区能否程序化跳转到指定会话（点击通知跳会话的可行性）？
6. **结论建议**：综合以上，给出「通知触发点放宿主半区还是 client 半区」的初步倾向与理由（最终接线由规格票定）。

## Answer

报告：`.scratch/turn-notify/research/dsh-plugin-surface.md`（逐条结论带出处：本仓 src / node_modules 0.1.5-rc.1 类型声明 / 官方 docs 0.1.5-rc.2 / dsh-token-dashboard·vision 范本）。

结论 gist：

1. **轮次完成事件**：宿主半区 `ctx.on('session/event', (session, event) => …)` + `event.type === 'turn/end'`（官方 `/loop` 同款信号）；失败不是独立事件，是 turn/end 的 `reason.kind === 'error'` 变体。0.1.5 该宿主面零变化；client 半区传输改走 `/api/remote.mux` WebSocket，但 `session/event` 不在转发允许清单（`API_REMOTE_FORWARDED_EVENTS`），client 只能吃 `api-session/status`（running 边沿，agent 粒度）与 `api-session/error`（string）。
2. **事件载荷**：`event.data = { turn, reason }`；reason 六变体（completed/aborted/blocked/error/max-tokens/interrupted），error 带 `LlmFailure{message,code,status}` 可区分正常与报错；header 无会话名——宿主经 `ctx.sessionTitle.get(session)` / `foldSessionTitle()` / `fallbackSessionTitle` 取 log-backed title，client 经 `useSessions` 的 `displayTitle`。
3. **设置持久化**：官方 settings 命名空间——宿主 `ctx.settings.installSection('turn-notify', schema, …)` 落 `$DSH_HOME/settings.yaml`（热重载）；client 卡经 `ctx.settingsScope.bind({namespace}).set()` 写回宿主，宿主 `watch()` 即见，两半区不需要各自持久化。
4. **设置卡槽位**：`settings.plugin.item`（keyed，key = 命名空间），`ctx.slots.inject + ctx.slots.register({name, key, locale, inject}, Card)`，client inject `['slots','locale','connection','remote','settingsScope']`；全页用 `settings.section`、单行用 `settings.general.item`。
5. **路由**：可行——client 服务 `ctx.sessions.open(sessionId)`（id 须在列表内；vision 已有 client 注入 `'sessions'` 先例）；通知点击把 sessionId 送进 client 半区后跳转。
6. **触发点倾向**：混合——判定（成败/粒度/标题）放宿主半区，经插件自有 exact route（token-usage snapshot 形状）暴露给 client，client 判相关性（选中态/可见性）并发通知、点击 `ctx.sessions.open` 跳转；备选最短路 = 纯 client 半区吃 `api-session/status`/`api-session/error` 转发事件（粒度与失败细节受限），适合 05 原型先行。
