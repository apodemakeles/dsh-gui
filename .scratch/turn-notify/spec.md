# turn-notify · 功能规格（v1）

决议来源：01–05 票 + 本票（06）。dsh 相关依赖保持 pin 0.1.5-rc.1，不升级。

## 1. 功能定义

每轮对话处理完成后，若壳不在前台焦点，弹 macOS 系统通知：**title = 会话名，body =「处理完成」/「处理失败」**，点击通知聚焦窗口并跳转该会话。开关注册在 web client 设置卡（官方 `settings.plugin.item` 机制），持久化 `$DSH_HOME/settings.yaml` 的 `turn-notify.enabled`（boolean，**默认开启**，热重载）。

## 2. 行为规格

### 2.1 触发与成败映射（04 票 + 06 修正）

宿主半区 `ctx.on('session/event')` 判 `event.type === 'turn/end'`，按 `event.data.reason.kind` 映射：

| reason.kind | 行为 | 备注 |
|---|---|---|
| `completed` | body「处理完成」 | |
| `max-tokens` | body「处理完成」 | 报告注「插件可能续跑」——若被接续会再弹一条最终完成，接受此噪音 |
| `blocked` | body「处理完成」 | 报告仅注「被阻断」；若实测语义为「等待用户操作」，实现票可把文案单点改「需要你处理」 |
| `error` | body「处理失败」 | `LlmFailure` 细节**不上屏**（只带会话名决议，01 票） |
| `aborted` | 静默 | 一切 cause（user/parent/hook/disposed）都视为在场的主动取消 |
| `interrupted` | 不会到达 | 崩溃孤儿回填标记，loop 不实时 emit（06 票查实，修正 04 票原表述） |

### 2.2 相关性过滤（宿主侧，全过才发）

1. `turn-notify.enabled === false` → 不发（宿主 `scope.watch` 热生效）
2. 子代理/委派会话（`session.header.origin === 'subagent'`）→ 不发（06 票）
3. 「重启期间不弹、不补弹」（04 票）天然满足：只处理实时事件流，不扫描历史；补投影不经过 `session/event`

### 2.3 焦点闸门（壳侧）

事件到达时 `!win.isFocused() && !lastFocused` 才弹；窗口销毁/启动 splash 期一律按后台。**不用 app 级 active 信号**（dock 隐藏模式下不可靠）——用 client `BrowserWindow` 的 `focus`/`blur` 缓存 + 通知时刻 `isFocused()` 快照（03 票）。

### 2.4 通知内容与点击（05 票）

- title：log-backed title（`ctx.sessionTitle.get(session)` 最新值；无则 `fallbackSessionTitle` / `header.cwd` basename）
- body：「处理完成」/「处理失败」
- 点击：`win.focus()` + `webContents.send('turn-notify:open-session', sessionId)` → client 半区 `ctx.sessions.open(sessionId)`
- 不聚合、不冷却（04 票）；专注模式拦截是系统级，不自做（03 票）；不用通知 actions 按钮（未签名形态不可用，03 票）

## 3. 接线方案（02 + 03 票综合）

**宿主判定 → 壳通知 → client 跳转**：

1. **宿主半区** `src/features/turn-notify/host/` 的 `applyTurnNotify(ctx)`：
   - `ctx.settings.installSection(ctx, 'turn-notify', Config, ConfigSchema)`——`Config { enabled: boolean = true }`（02 票 Q3，cookbook 形状）
   - 在 `ctx.webServer` exact 路由表注册 SSE 端点（如 `GET /turn-notify/events`，token-usage snapshot 同款形状）：判定通过后推送 `{ sessionId, title, outcome: 'ok' | 'fail' }`
   - 该端点经 `src/index.ts:90` 的同一 Unix socket 分发表可达（exact 先于 /api rpc）；**要求鉴权**：壳侧连接带 launch token 铸的 auth cookie，避免本地进程未授权读会话名流
2. **壳主进程** `src/shell/main/notifications.ts`（新增，main/index.ts 接线）：
   - 经 `fetchOverUnixSocket`（`src/assembly/unix-http.ts:141`，纯函数两半区可复用）订阅该 SSE
   - 焦点闸门 → `new Notification({ title, body })`；`click` → 聚焦 + send
   - 权限：未签名 .app 首次发通知系统自动弹一次性授权框，无需预授权（03 票）
3. **preload**：若 `__DSH_TRANSPORT__` 已有通用 main→renderer 事件口则复用；否则加最小 `onOpenSession(cb)`
4. **client 半区** `src/features/turn-notify/client/` 的 `applyTurnNotifyClient(ctx)`（cookbook 形状，inject `['slots','locale','connection','remote','settingsScope']` + `'sessions'`）：
   - 设置卡：`ctx.slots.inject('settings.plugin.item', …)`，`key: 'turn-notify'`；卡片内容 = title/description/toggle，**视觉形态由官方设置页渲染，不自定义**（05 票）
   - 跳转接收：transport 事件 → `ctx.sessions.open(sessionId)`

## 4. 文件落点

- `src/features/turn-notify/host/index.ts` + 注册进 `src/index.ts` 的 `apply()`
- `src/features/turn-notify/client/index.ts` + 注册进 `src/client/index.ts`
- `src/features/turn-notify/shared/types.ts`（两半区共享的 TurnNotifyEvent 等）
- `src/shell/main/notifications.ts` + `src/shell/main/index.ts` 接线；`src/shell/preload/` 增量
- vitest 覆盖可测纯逻辑：reason→outcome 映射、title 回退链、焦点闸门判定（纯函数化）、SSE 载荷→通知决策

## 5. 验收标准

`pnpm typecheck` 与 `pnpm test` 通过，外加手工清单：

1. 顶层会话一轮完成、壳失焦 → 弹「处理完成」
2. 报错轮次（如断网）→ 弹「处理失败」
3. 自己点停止 → 不弹
4. 子代理轮次完成 → 不弹
5. 壳在前台时完成 → 不弹；失焦后完成 → 弹
6. 点通知 → 窗口聚焦且跳到该会话
7. 设置卡关闭 → 不再弹；`settings.yaml` 出现 `turn-notify.enabled: false`；外部热改生效
8. 全新 `settings.yaml`（无该段）→ 默认开启
9. `pnpm package:mac` 产出的 .app：首次通知弹系统授权框，授权后正常
10. spawn 模式（`dsh --profile gui`）与启动器模式（.app）通知链路都通

## 6. 兼容性

- 0.1.5-rc.1 宿主事件面零变化（02 票）；不新增 dsh.bundle 声明、不建独立插件包
- Electron ≥42 通知后端将要求真实签名——升级核对项已记入地图 Notes（03 票）
