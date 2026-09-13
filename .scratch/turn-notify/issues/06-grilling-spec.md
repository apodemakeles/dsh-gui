# 06 · grilling：规格定稿

Type: grilling
Status: resolved
Blocked by: 04, 05

## Question

把 01–05 的全部决议汇总成一份可实施的功能规格（写进本票 Answer 或独立 `spec.md`）：

1. **接线方案**：轮次完成信号从 dsh 宿主事件到壳主进程通知的端到端链路（宿主半区触发 vs client 半区触发，跨进程通道选型）；开关配置的持久化与读写路径。
2. **功能模块落点**：`src/features/turn-notify/` 双半区的文件划分与注册点。
3. **行为规格**：触发条件（失焦判定实现口径）、通知内容（会话名、成败文案）、点击行为、04 票拍定的策略条款。
4. **验收标准**：手工验证清单（多会话、失焦/回焦、失败轮次、开关关闭、.app 打包形态）+ `pnpm typecheck` / `pnpm test`。
5. 兼容性核对：不升级 dsh 依赖的前提下 0.1.5-rc.1 事件面是否满足；若不满足，降级方案。

## Answer

规格定稿会话（2026-09-13）完成，**规格正文：[spec.md](../spec.md)**（本 effort 的实施依据，实现票直接照此开工）。要点：

1. **接线**：宿主判定（settings 开关 + session/event 过滤 + 命名）→ `ctx.webServer` exact 表上的 SSE 端点（同 Unix socket 可达、带 auth cookie）→ 壳主进程 `fetchOverUnixSocket` 订阅、焦点闸门、发 Notification → click 经 transport 送 sessionId → client `ctx.sessions.open` 跳转。
2. **两处对 04 票的修正**（依据 02 票报告查实）：`interrupted` 是崩溃孤儿回填标记、loop 不实时 emit，天然到不了（静默条款改注「不会到达」）；「自己停的」实际对应 `aborted`（一切 cause 静默）。
3. **新增决议**：开关默认开启；子代理会话（`origin === 'subagent'`）不通知；`max-tokens` 被续跑时接受二次弹噪音；`blocked` 暂按「处理完成」，实现票可单点改文案。
4. 验收 = typecheck/test + 十条手工清单（含 .app 授权框与两种启动形态）。
