# Research · Electron/macOS 通知能力、失焦判定与跨进程通道

- Type: research（对应 `.scratch/turn-notify/issues/03-research-electron-notify.md`）
- Date: 2026-09-13
- 环境基线：本仓库 pin Electron `^37.3.1`（实际安装 **37.10.3**，`node_modules/electron/package.json`）；打包产物为**未签名未公证** `.app`（electron-builder `dir` target，`scripts/package-mac.mjs`，ADR 0003「不签名不公证」）。

> 来源标记约定：`仓库文件:行号` = 本仓一手源码；`electron.d.ts:L` = `node_modules/electron/electron.d.ts`（37.10.3）；Electron 源码/文档均指 `v37.10.3` tag；Apple 文档给 URL。

---

## Q1 · 通知 API：Electron `Notification` 在 macOS 上的能力、限制与未签名 .app 的授权现实

### 1.1 关键背景：我们钉住的 Electron 37 用的是 **NSUserNotification 后端**（不是 UNUserNotificationCenter）

- Electron 42（2026-03 合入，PR electron/electron#47817）才把 macOS 通知后端从弃用的 NSUserNotification 换成 UserNotifications 框架：PR 标题 "feat: replace deprecated NSUserNotifications with User Notifications"（https://github.com/electron/electron/pull/47817）。
- 本仓 Electron 37 的后端一手源码：`shell/browser/notifications/mac/notification_presenter_mac.mm`（v37.10.3）使用 `NSUserNotificationCenter.defaultUserNotificationCenter` + `deliverNotification:`，整个文件压着 `#pragma clang diagnostic ignored "-Wdeprecated-declarations"`。`shell/browser/notifications/mac/cocoa_notification.mm` 的 `Show()` 直接 `[[NSUserNotification alloc] init]` → `deliverNotification:`。
- 结论：**在 Electron 37 上，macOS 通知走的是 10.14 时代就弃用、但至今（macOS 15/26）仍能工作的 NSUserNotification API**。这决定了下面授权行为与 Electron 42+ 完全不同，也决定了能力上限（见 1.3）。

### 1.2 授权现实（未签名 .app 形态）

- **授权提示是"设置 NSUserNotificationCenter delegate"这个动作触发的，与签名无关。** 一手证据：OpenJDK bug JDK-8264786（https://bugs.openjdk.org/browse/JDK-8264786）——一个最小 Objective-C app 仅执行 `[[NSUserNotificationCenter defaultUserNotificationCenter] setDelegate:self]` 就会让系统弹出 "" Notifications — Don't Allow / Allow"。Electron 37 的 presenter 初始化正是这一行（`notification_presenter_mac.mm`：`NSUserNotificationCenter.defaultUserNotificationCenter.delegate = notification_center_delegate_`）。
- **触发时机（Electron 侧）是懒加载**：`shell/browser/electron_browser_client.cc`（v37.10.3）`ElectronBrowserClient::GetNotificationPresenter()` 在第一次需要 presenter 时才 `NotificationPresenter::Create()`（即第一次 `new Notification(...).show()` / web 通知）。所以系统授权弹窗出现在**壳第一次发通知时**，而非 app 启动时。
- 弹窗归属名 = app bundle 的显示名：打包后是 `productName` = `dsh-gui`（`package.json:163`）；开发态跑 `node_modules/electron/dist/Electron.app` 时归属 `Electron`（实测该 bundle 的 `CFBundleIdentifier=com.github.Electron`、`CFBundleName=Electron`）。
- **bundle id**：打包 .app 的 `CFBundleIdentifier` 来自 electron-builder `build.appId` = `com.apodemakeles.dsh-gui`（`package.json:162`）。通知中心按 bundle id 记住授权决定——改 bundle id = 新身份 = 重新弹授权。壳内 `app.setName(APP_NAME)`（`src/shell/main/index.ts:15`）只改 `app.name`/userData 目录，**不影响** CFBundleIdentifier。
- **用户点了 Don't Allow / 或事后手动关掉怎么办**：系统级强制，app 侧无 API 能查或改（NSUserNotification 时代无授权 API）。用户必须去 系统设置 → 通知 → `dsh-gui` 手动打开（Apple：通知送达"ultimately subject to the user's preferences. If the user decides to hide all alerts from your application … the user won't see any animation or hear any sound"，https://developer.apple.com/documentation/foundation/nsusernotificationcenter）。首次弹出后默认样式是 Banners（自动消失），可换 Alerts/无。`new Notification()` 一律静默 no-op，`show` 事件可能仍触发，容易误判——需要用「通知没出现」做一次人工验收（Electron 文档也只推荐 userland 模块 `macos-notification-state` 预查：https://github.com/felixrieseberg/macos-notification-state）。
- **签名与否的边界**：
  - Electron 37（NS 后端）：未签名/未公证 `.app` **可以**发通知、会弹授权、`click` 等事件可用。无需 Developer ID。（ADR 0003 的"不签名"决策不被通知功能破坏。）
  - Electron 42+（UN 后端）：行为改变——`requestAuthorization` 模型 + click 事件依赖 `didReceiveNotificationResponse`，社区实测 "since 42, macOS notification events require a code-signed app"（electron/electron#51885 报告原文）。**若将来升级 Electron ≥42，通知功能将成为必须签名（至少 ad-hoc 不够，需真实身份）的第一个硬依赖**——升级 dsh 前按 AGENTS.md §6 核对 CHANGELOG 时把这条加进清单。

### 1.3 能力与限制逐项（Electron 37.10.3，macOS）

| 项 | 结论 | 出处 |
|---|---|---|
| `title` / `body` | 支持 | `NotificationConstructorOptions`，electron.d.ts:21188-21200；docs/api/notification.md:36-38 |
| `subtitle` | 支持（仅 macOS） | electron.d.ts:21192-21196；notification.md:37 |
| `click` 事件 | 支持：banner/alert 主体点击 → `NSUserNotificationActivationTypeContentsClicked` → `NotificationClicked()` → `Emit("click")` | `notification_center_delegate.mm`（v37.10.3）；`shell/browser/api/electron_api_notification.cc:143`；electron.d.ts:9992 |
| `actions`（附加按钮） | **未签名 app 上不可用**。官方明确：macOS 额外按钮要求 ①App is signed ②Info.plist `NSUserNotificationAlertStyle=alert`，"If either of these requirements are not met the button won't appear"；且第一个 button 之外的按钮退化为 hover 才出现的 additional actions、与 `hasReply` 互斥 | https://github.com/electron/electron/blob/v37.10.3/docs/api/structures/notification-action.md（"Button support on macOS"）；`cocoa_notification.mm` 的 setActionButtonTitle/additionalActions 映射 |
| `hasReply`（内联回复）+ `reply` 事件 | macOS 支持 | electron.d.ts:10059-10075（'reply' _darwin_）、21217-21220；`notification_center_delegate.mm` Replied 分支 |
| `timeoutType` | **macOS 不支持**（选项与实例属性都标 `@platform linux,win32`）；macOS banner/alert 显示时长由系统通知设置决定 | electron.d.ts:21227-21230、10176-10181；notification.md:42 |
| `silent` / `sound` | macOS 支持；`sound` 是 NSSound 名或 bundle Resources 下的自定义文件；`silent` 时不放声 | electron.d.ts:21221-21224；notification.md:189-202；`cocoa_notification.mm` setSoundName 分支 |
| `icon` | 映射为 NSUserNotification 的 `contentImage`（通知右侧大图），不是角标小图 | `cocoa_notification.mm` setContentImage |
| 正文长度 | **256 字节截断**（Apple 通知尺寸限制，Electron 文档明说） | https://github.com/electron/electron/blob/v37.10.3/docs/tutorial/notifications.md（macOS 节 "notifications are limited to 256 bytes in size and will be truncated"） |
| 前台时是否显示 | **显示**：Electron delegate `shouldPresentNotification` 恒返回 YES（"Display notifications even if the app is active"）——前台抑制要自己做（这正是失焦判定的用途） | `notification_center_delegate.mm`（v37.10.3）；Apple NSUserNotificationCenter 文档说默认可抑制前台通知、delegate 可覆盖 |

主进程 `Notification` 的形态化示例（点击 → 前台化窗口）：

```ts
const n = new Notification({ title, subtitle, body })
n.on('click', () => { win.show(); win.focus() })
n.show()
```

### 1.4 小结（授权现实）

打包 .app（`com.apodemakeles.dsh-gui`，未签名）：用户**第一次收到通知时**系统弹一次 ""dsh-gui" would like to send you notifications" 授权框（不必先去系统设置）；Allow 后通知即工作。若 Allow 被拒/误关，用户必须手动去 系统设置 → 通知 → dsh-gui 打开——代码侧只能检测到"没弹出来"。bundle id 一经发布不要改。附加按钮 actions 因未签名不可用（v1 不要依赖）；`click`（点 banner 主体）够用。

---

## Q2 · 失焦判定：推荐一套可靠的「壳不在前台」

### 2.1 语义盘点（Electron 37.10.3 d.ts 一手）

- **`app` 上没有 `focus`/`blur` 事件**。`App` 接口事件全列表里只有 `browser-window-focus` / `browser-window-blur`（"Emitted when a browserWindow gets focused/blurred"，electron.d.ts:182-217）与 darwin 专属 `did-become-active` / `did-resign-active`（"Emitted when the application becomes active… also emitted when a user switches to the app via the macOS App Switcher"；"Emitted when the app is no longer active and doesn't have focus"，electron.d.ts:417-455）。`focus`/`blur` 事件定义在 `BaseWindow`（electron.d.ts:2070/2116，"Emitted when the window loses/gains focus"）与 `BrowserWindow`。
- **`win.isFocused()`**：`BrowserWindow`/`BaseWindow` 实例方法（electron.d.ts:2821/5511），即"该窗口是否是 key window"。
- **`activate` ≠ 变活跃**：darwin 的 `activate` 只在点 Dock 图标/重启 app 时发，`did-become-active` 每次变活跃都发（electron.d.ts:417-427 注释明说差异）。

### 2.2 两种启动形态对焦点事件的影响

- **宿主 spawn 模式**（`dsh --profile gui`）：壳只有 1 个 client 窗口（`src/shell/main/index.ts:66`），且 `app.dock?.hide()`（`src/shell/main/index.ts:64`）→ 运行期 activation policy 变 accessory（无 Dock 磁贴/Cmd-Tab 项）。app 级 `did-become-active`/`did-resign-active` 在 accessory 形态下语义弱化（无 Dock/App Switcher 路径），**不要把它当主信号**；窗口级 focus/blur 不受影响。
- **launcher 模式**（双击 .app）：先 splash 后 client 两个窗口（`src/shell/main/launcher.ts:131,181`），Dock 可见；`second-instance` 时用 `win.restore()+win.focus()` 拉前台（`src/shell/main/launcher.ts:192-198`）——判定"不在前台"必须把 splash 期也算进去（splash 期不该发通知，直接跳过即可）。
- `app.on('browser-window-blur')` 只是窗口事件的广播转发，信息量与直接在窗口上听一致。

### 2.3 推荐（做在壳主进程，与通知同处）

```ts
// clientWindow = createClientWindow(...) 返回的 BrowserWindow
let lastFocused = false
clientWindow.on('focus', () => { lastFocused = true })
clientWindow.on('blur',  () => { lastFocused = false })
clientWindow.on('closed', () => { lastFocused = false })

function shellIsInBackground(): boolean {
  // 窗口已销毁/不存在（splash 期）→ 一律视为后台，不弹通知
  if (clientWindow === undefined || clientWindow.isDestroyed()) return true
  return !clientWindow.isFocused() && !lastFocused
}
```

- **判定语义**：`isFocused()` 是通知时刻的即时快照，`blur/focus` 缓存值兜底两类边角：macOS 上 focus/blur 事件与状态查询存在微小的异步窗口；以及窗口 `closed` 后 `isFocused()` 无意义。
- **为什么不用 app 级信号**：见 2.2（accessory 形态）＋ `app` 根本没有 focus/blur 事件。`did-resign-active` 可作为 launcher 模式的补充信号，但非必需。
- **为什么不用 renderer 的 `document.hasFocus()`**：等价于窗口 key 状态，但要跨 IPC 把"轮次完成"通知从主进程拿到渲染进程再拿回来，绕远；渲染进程只是 client 页面。
- **边界行为确认**：macOS 上点开 Spotlight、通知中心、切到别的 app，key window resign → `blur` 触发 ✓；同 app 内多窗口（本项目实际只有 client 一个，splash 期例外）；窗口最小化 → `blur` ✓（`isMinimized()` 另有方法可查，launcher.ts:196 已在用）。
- 产品语义提示：Electron 37 的 delegate `shouldPresentNotification` 返回 YES（见 1.3），**前台时通知也会弹**——"后台才通知"这层闸门 100% 是壳自己的职责，系统不替你做。

---

## Q3 · 跨进程通道：「轮次完成」从宿主半区（Cordis）到壳主进程

### 3.0 现有机制盘点（一手源码）

| 机制 | 内容 | 出处 |
|---|---|---|
| 会话文件 + env | 宿主把 `ShellSession`（socketPath/distRoot/indexPath/pluginBundles/authToken）写 `session.json`（tmp+rename 原子），路径经 env `DSH_GUI_SESSION` 传给壳 | `src/assembly/session.ts:3,13-28`；`src/host/session-files.ts:31-69` |
| 宿主 spawn 壳 | `spawn(electronBinary, [mainEntry], { env: {…, DSH_GUI_SESSION}, stdio: ['ignore','inherit','inherit'] })`，宿主 watch 子进程退出 | `src/host/spawn-shell.ts:14-35` |
| launcher 外部壳握手 | 壳 spawn 宿主时传 `DSH_GUI_EXTERNAL_SHELL_DIR`（`src/assembly/session.ts:5-11`），宿主把握手写到该目录，壳轮询 + probeSocket | `src/shell/main/launcher.ts:154-168,206-238` |
| Unix HTTP 载体 | 宿主 `listenFetchOnUnixSocket(socketPath, fetchHandler, upgradeHandler)`（fetch 形状、**Response body 流式透传**、支持 upgrade）；壳的 http-surface 把 `/api`、`/`、upgrade 按请求代理到该 socket | `src/assembly/unix-http.ts:55-136`；`src/shell/main/http-surface.ts:114-162` |
| loopback TCP surface | 壳主进程 `http://127.0.0.1:<临时端口>`，仅伺服页面+代理，ADR 0001 修订版不变式："TCP 侧在壳进程，纯代理，无独立业务" | `src/shell/main/http-surface.ts:42-178`；`docs/adr/0001-custom-protocol.md:38-47` |

关键事实：**壳主进程本来就是一个 node 进程，且已经持有 `session.socketPath`，与宿主 Unix socket 之间已有现成客户端工具 `fetchOverUnixSocket`（`src/assembly/unix-http.ts:141-191`）。宿主 Unix 载体的 fetch handler 已支持流式 Response（`pipeWebBody`，unix-http.ts:126-136）**——这是所有候选里最重要的既有杠杆。

### 3.1 候选 A（推荐）：壳主进程直连宿主 Unix socket，订阅 shell 专用 SSE/长轮询下行

- 宿主侧：`src/index.ts:90` 的 fetch handler 里为壳保留一个私有命名空间（如 `GET /dsh-gui-shell/events`，放在官方 exact-route 分派**之前**，避免与官方路由冲突），返回 SSE 流（`text/event-stream`）或无限期 chunked 流；「轮次完成」事件源（Cordis `sessions` 服务的事件）往里写 `data: {"type":"turn-complete","sessionId":…}\n\n`。
- 壳侧：main 进程在 `whenReady` 后用现成的 `fetchOverUnixSocket(session.socketPath, 'http://127.0.0.1/dsh-gui-shell/events')` 建立长连接，解析事件 → 失焦时 `new Notification().show()`。断线重连退避即可（宿主死→壳会跟着退，连接生命周期天然同寿）。
- 优点：
  1. **零新增监听面**：不新开 socket、不开新 TCP 端口，完全符合 ADR 0001 修订版不变式（Unix socket 仍是宿主唯一监听面）；
  2. 复用现有握手（session.json 里已有 socketPath）、现有客户端工具、现有信任边界（socket 仅本机可达，同壳代理 /api 的信任级别一致；可再校验 query 里的 `authToken` 防本机低权限进程试探）；
  3. 两种启动形态（宿主 spawn / launcher）**同一条通路**，无需分支；
  4. 流式已在载体层验证过（/api SSE、remote.mux WS 都走这条 socket）。
- 缺点/注意：SSE over 自研 fetch 载体要处理 res close → abort（unix-http.ts:70-73 已有）；事件需要保活心跳防中间无超时（同 socket 直连，无代理层，风险小）；壳重启（window closed 即整个壳退出，`src/shell/main/index.ts:67-73`）所以连接无需跨壳会话复用。

### 3.2 候选 B：壳的 loopback HTTP surface 加内部端点（宿主 POST `http://127.0.0.1:<port>/internal/notify`）

- 壳在 http-surface 上加 `POST /dsh-gui-internal/notify`（校验随机 token），宿主「轮次完成」时 POST 上来 → 壳发通知。
- **硬伤是方向反了**：surface 端口由壳启动时临时分配（http-surface.ts:166 `listen(0)`），宿主不知道。要打通需壳→宿主的反向告知（壳往 session.json 旁边写 endpoint 文件 + 宿主轮询/watch），等于先解决一次"壳→宿主"通信才能解决"宿主→壳"通信，两个握手、两个密钥。
- 另外破坏 ADR 0001 修订版"TCP 侧纯代理、无独立业务"的表述（要改 ADR 才合规）。
- 优点仅剩：推送语义直白（无长连接）。结论：**不推荐**，除非候选 A 的长连接被证明不可靠。

### 3.3 候选 C：spawn stdio 协议（NDJSON over fd）

- 宿主 spawn 壳改 `stdio: ['pipe','inherit','inherit']`，宿主往 `child.stdin` 写 `{"type":"turn-complete",…}\n`，壳 main 解析 process.stdin。launcher 形态下方向相反（壳 spawn 宿主，launcher.ts:160 `stdio: ['ignore', logFd, logFd]`），需改 fd3 pipe 并两种形态各写一套。
- 优点：无网络栈、顺序有保证。
- 缺点：与两种启动形态强耦合（同一功能两份实现）；与 `'inherit'` 日志语义纠缠（现在宿主日志直通 dsh 终端，spawn-shell.ts:23）；壳崩溃重启/宿主重启后的重握手要自己做；抽象层级低。**不推荐作为主通道**，但可留作"宿主→壳"最后一公里保底。

### 3.4 推荐

**候选 A**（壳直连宿主 Unix socket 订阅 SSE）：实现集中在 `src/index.ts` 宿主 fetch handler 加一条保留路由 + 壳 main 加一个订阅模块，零新监听面、零新握手、两种形态统一，且流式能力已被 /api SSE 与 remote.mux WS 两条既有流量验证。

---

## Q4 · 系统行为：专注模式拦截与通知中心堆叠

- **专注模式（Focus/勿扰）拦截是系统级的，插件无需自做免打扰。** 出处：
  - Apple：`UNNotificationInterruptionLevel` 各档位描述全部以"the system presents/suppresses"为主语——`timeSensitive`："breaks through **system notification controls**"；`filterCriteria`："The criteria **the system evaluates** to determine if it displays the notification in the current Focus"（https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel 及 UNMutableNotificationContent/filterCriteria）。
  - Apple 用户文档："Set up a Focus on Mac"——Focus 用于 pause/silence all notifications（https://support.apple.com/guide/mac-help/mchl613dc43f/mac）。
  - 被拦截的通知**进通知中心历史**（silenced delivery），不弹 banner、不放声——用户稍后点菜单栏时钟可见，不丢。
- **壳侧职责边界**：
  1. Electron `Notification` **没有** interruptionLevel / time-sensitive 选项（`NotificationConstructorOptions` 全量核对：electron.d.ts:21186-21246，只有 title/subtitle/body/silent/icon/hasReply/timeoutType/replyPlaceholder/sound/urgency/actions/closeButtonText/toastXml）——所以我们**连"突破专注模式"的选项都没有**，被拦是纯系统行为，接受即可；
  2. `silent: true` 只压通知声，与专注模式无关；
  3. 需要预查勿扰状态才用 userland 模块（`macos-notification-state`），但它依赖私有 API、对 Monterey+ 的 per-Focus 设置不可靠——**不建议**依赖它做产品逻辑。
- **通知中心堆叠行为确认**：macOS 通知 banner 从屏幕右上角出现，多条新到通知纵向堆叠；banner 未点击会自动收进通知中心（alert 样式则常驻直到手动关闭）；同一 app 连续多条通知按到达顺序堆叠，`deliverNotification` 重复 show 同一 `Notification` 实例会先撤旧再发新（notification.md:126-127 "If the notification has been shown before, this method will dismiss the previously shown notification"）。给 dsh 的场景：轮次完成连发多条会堆叠，属正常 macOS 行为；若嫌吵可按 sessionId 合并（只发最新一条 + 计数）。

---

## 结论速览

1. **通知 API**：Electron 37 的 macOS 通知走 NSUserNotification（UN 后端是 Electron 42+ 的事）。未签名 `.app`（bundle id `com.apodemakeles.dsh-gui`）第一次发通知时系统自动弹一次性授权框，Allow 后即用；被拒后只能引导用户去 系统设置 → 通知 → dsh-gui 手动开。`click` 可用；`actions` 按钮因未签名不可用；`timeoutType` 是 win/linux 专属；正文 256 字节截断；前台弹横幅是 Electron 默认（需自己做失焦闸门）。
2. **失焦判定**：`app` 没有 focus/blur；用 client `BrowserWindow` 的 `focus`/`blur` 事件 + `isFocused()` 快照组合（宿主 spawn 模式 Dock 隐藏使 app 级 active 信号不可靠）。判定封装为 `!win.isFocused() && !lastFocused`（窗口销毁/ splash 期一律按后台处理）。
3. **跨进程通道**：推荐**壳主进程用现成的 `fetchOverUnixSocket` 直连宿主 Unix socket、订阅宿主 fetch handler 上的 shell 专用 SSE 端点**（零新监听面、零新握手、两形态统一）；loopback 内部端点（端口反告知困境）与 stdio NDJSON（两套形态两套实现）列为备选。
4. **系统行为**：专注模式拦截是系统级（App 无 API、也不该绕）；被拦通知静默进通知中心不丢失；banner 右上角堆叠是系统行为，重复 show 同一实例会替换旧条目。
