# turn-notify · 决策地图（wayfinder）

Type: map

## Destination

功能模块 **turn-notify** 上线并入 main：每轮对话处理完成后，若壳不在前台焦点，弹 macOS 系统通知（只带会话名，成败文案区分），开关注册在 web client 设置卡。地图走完 = 决策票全部闭合 + 实现票完成（`feat/turn-notify` 短命分支 → 实现 → 验证 → PR 合入）。

## Notes

- **功能模块纪律**（AGENTS.md §2）：`src/features/turn-notify/` 双半区——宿主侧 `applyTurnNotify(ctx)` 注册进 `src/index.ts` 的 `apply()`，浏览器侧 `applyTurnNotifyClient(ctx)` 注册进 `src/client/index.ts`；不建独立插件包、不新增 dsh.bundle 声明。
- **术语**遵循 [CONTEXT.md](../../CONTEXT.md)（壳、功能模块、IPC fetch carrier、启动器模式、外部壳）。
- **依赖纪律**：dsh 相关依赖 pin 在 0.1.5-rc.1，不得升级；改动若需适配先核对官方 CHANGELOG。
- **分支纪律**：实现走短命分支 `feat/turn-notify` → PR → squash merge；本地图与票文件的提交由作者决定（.scratch 随库提交）。
- **验证**：实现票完成前跑通 `pnpm typecheck` 与 `pnpm test`。
- **本 effort 覆盖 wayfinder 默认 plan-don't-do**：实现纳入地图（作者 charting 决议，详见 01 票）。
- **原型票是 HITL**：作者明确要求出多套原型供选择，agent 不得替选。
- research 子代理涉及外网请求先设代理：`export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=http://127.0.0.1:7890`。
- **升级核对项**（03 票结论）：本仓 Electron 37 的 macOS 通知走 NSUserNotification 后端，未签名可用；Electron ≥42 换 UNUserNotificationCenter 后通知要求真实签名——未来升级 Electron 前必须重核通知能力（03 票报告有细节）。
- 官方文档：deepseek-harness 的 `docs/`（插件教程 `docs/user/develop/basic/`、cookbook）；本仓库存档调研 `.scratch/dsh-gui-scaffold/research/`；范本插件 `dsh-token-dashboard`。

## Decisions so far

- [charting 决议（目的地与产品语义）](issues/01-charting-decisions.md) — 目的地含实现；失焦即通知；设置卡开关；通知只带会话名不含内容；每轮都通知、成败都通知。
- [Electron/macOS 通知与失焦、跨进程通道](issues/03-research-electron-notify.md) — 未签名 .app 首次发通知系统自动弹授权（无需预授权，actions 按钮不可用）；失焦判定用 BrowserWindow focus/blur 缓存 + isFocused 快照（app 级 active 信号在 dock 隐藏模式下不可靠）；通道推荐壳经 `fetchOverUnixSocket` 订阅宿主 fetch handler 上的 shell 专用 SSE 端点（零新监听面，两种启动形态同通路）；专注模式拦截是系统级，无需自做免打扰。详见 `.scratch/turn-notify/research/electron-macos-notification.md`。
- [dsh 插件能力面（事件、设置、槽位、路由）](issues/02-research-dsh-surface.md) — 宿主半区 `ctx.on('session/event')` 判 `turn/end`，`reason` 六变体可区分成败且 error 带 `LlmFailure`；会话名宿主经 `ctx.sessionTitle.get` / client 经 `useSessions.displayTitle` 均可得；配置持久化用官方 settings 命名空间（宿主 `installSection` + client `settingsScope.bind`，两半区一个事实源热重载）；设置卡槽位 `settings.plugin.item`（0.1.5-rc.1 用 `key`）；client 跳会话 `ctx.sessions.open(sessionId)` 可行（vision 有先例）；触发点初步倾向混合式——成败/标题判定放宿主、通知发出与相关性判断放 client，备选纯 client 吃 `api-session/status` 下降沿（代价：排队 turn 不可分辨、失败只有 string）。详见 `.scratch/turn-notify/research/dsh-plugin-surface.md`。
- [通知策略细案](issues/04-grilling-strategy.md) — `completed`/`max-tokens`/`blocked` →「处理完成」，`error` →「处理失败」，自己主动停止的（`aborted`/`interrupted`）静默；不自建冷却；宿主/壳重启期间与补投影迟到的完成不弹、不补弹；设置卡只一个总开关 + 说明文案。
- [原型选型](issues/05-prototype-notify.md) — 通知排版选 A（title=会话名、body=处理完成/失败，真机已复核）；设置卡不自定义卡片，走官方 `settings.plugin.item` 机制注册（key=命名空间），形态由官方渲染；点击行为=聚焦 + `ctx.sessions.open(sessionId)` 跳转该会话。资产：`.scratch/turn-notify/prototype/`（notify.sh、notification.html、settings-card.html）。
- [规格定稿](issues/06-grilling-spec.md) — 规格正文 [spec.md](spec.md)：接线=宿主判定→exact 表 SSE 端点→壳 `fetchOverUnixSocket` 订阅+焦点闸门→Notification→click 跳会话；开关默认开启；过滤子代理；`interrupted` 实为崩溃回填标记不会到达（修正 04）、`aborted` 一切 cause 静默；验收=typecheck/test + 十条手工清单。
- [实现交付](issues/07-task-implement.md) — PR #7 squash 合入 main（`5251a6c`）。实现层把 SSE 调整为长轮询（exact 路由分发是缓冲式）；真机过程中修了三处：token 整串比对被 `&wait` 打穿（集成测试抓出）、宿主 inject 缺 `settings`/`sessionTitle`、client inject 缺 `settingsScope`/`sessions`（cordis 强制声明，防御式判断也绕不开——已写进 AGENTS.md §2 纪律）；作者真机验收通过，effort 完成。

## Not yet specified

（已清空——原雾区已毕业：接线方案细案并入 [规格定稿](issues/06-grilling-spec.md) 的问题 1（02/03 两票给出候选与倾向，留待定稿拍板）；点击跳会话可行性已由 02 票回答、选择留给 [原型选型](issues/05-prototype-notify.md)；流式中断等边缘情况本就是 [策略细案](issues/04-grilling-strategy.md) 的问题。）

## Out of scope

- Windows/Linux 通知适配——本 effort 只做 mac（壳的平台现状如此，见 ADR 0003）。
- 自定义提示音、通知样式皮肤——依赖 macOS 系统通知中心默认呈现。
- 每会话粒度的通知开关——先做全局开关，粒度化留待后续 effort。
