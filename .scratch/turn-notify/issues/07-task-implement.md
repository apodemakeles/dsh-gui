# 07 · task：按规格实现 turn-notify 并交付 PR

Type: task
Status: resolved
Blocked by: 06

## Question

按 06 票定稿的规格实现功能模块 turn-notify：

1. 拉短命分支 `feat/turn-notify`。
2. 按 AGENTS.md §2 功能模块纪律落地 `src/features/turn-notify/` 双半区并注册。
3. 实现接线方案（宿主事件 → 壳通知）、设置卡开关、通知行为规格。
4. 跑通 `pnpm typecheck` 与 `pnpm test`；补 vitest（可测的纯逻辑部分，如配置读写、触发判定）。
5. 按 06 票验收清单手工验证（含 .app 打包形态的权限/焦点行为）。
6. 开 PR（约定式提交 `feat:`），等作者审阅合入。

Resolved = PR 合入 main。

## Answer

实现会话（2026-09-13）完成第 1–4 步，PR 已开：**https://github.com/apodemakeles/dsh-gui/pull/7**（feat/turn-notify → main，commit 2cefd1f）。票保持 claimed，resolve 条件 = PR 合入 main。

- 落点：`src/features/turn-notify/{shared,host,client}/`（协议/判定/队列/标题 + 设置卡 + 跳转桥）、`src/shell/main/notifications.ts`（轮询 + 焦点闸门 + Notification）、preload `__DSH_NOTIFY__` 桥；`src/index.ts` 与 `src/client/index.ts` 注册。
- 对规格的一处实现层调整：spec §3 原写 SSE——exact 路由经 `web-route-dispatch` 的 ResponseCapture 是缓冲式（`end()` 后才拼 Response），SSE 流不起来；改为**长轮询**（宿主挂住响应直到事件到达或超时），同一 socket、同一 exact 优先级、零新监听面。已在 PR 描述注明。
- 新增依赖 `@deepseek-ai/schemastery@3.18.2`（`dsh-settings@0.1.5-rc.1` 的 peer 同版本，`installSection` 需要 schema 构造器）；未动任何 dsh 包 pin。
- `pnpm typecheck` ✅；`pnpm test` ✅（115 tests / 24 files，新增 queue/decision/title/focus-gate 纯逻辑用例）；`pnpm build` ✅。
- 待办（resolve 条件）：作者走查 spec §5 十条手工清单 → PR 审阅合入。

### 终章（2026-09-13）：resolved

- CI 一度红：`plugin-shape.test.ts` 钉死的 inject 清单未随三次 inject 修复同步（本地全量测试没有在 inject 变更后重跑的教训）——补齐断言后 CI 绿（384bb20）。
- **作者真机验收通过**（通知含会话名、点击跳转正确、开关生效；首次授权弹窗按预期出现）。
- PR #7 squash 合入 main：`5251a6c`，分支已删。本 effort 完成。

### 追加（2026-09-13 下午）：真机启动失败已修

- 症状：打包 .app 启动报「plugin tree failed to load: cannot get property "settings" without inject」——cordis 要求 ctx 服务属性读取必须在插件 `inject` 清单声明，`applyTurnNotify` 触达的 `settings` / `sessionTitle` 未声明。
- 修复：`src/index.ts` inject 补 `'settings'`、`'sessionTitle'`（commit 6ec690c，已推 PR）。
- 宿主半区从仓库 lib 直载（gui profile），无需重打包 .app；`pnpm build:plugin` 后验证：无头宿主 ~4s 就绪、长轮询端点在真宿主上活体应答（正确 token `{"ok":true,"events":[]}`、错误 token 403）、打包 app 启动后 renderer 经壳 loopback surface 保持 ESTABLISHED（remote-event WS），客户端窗口正常。
- 附注：host.log 里 `token-usage: gap sweep failed … SessionFormatUnsupportedError` 为既有告警（对一个 v0 旧会话的补投影拒绝，9 月 12 日起存在），与 turn-notify 无关。
