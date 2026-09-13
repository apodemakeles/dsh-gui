# 03 · research：Electron/macOS 通知与失焦、跨进程通道

Type: research
Status: resolved

## Question

壳侧与平台侧的能力边界，逐条查清并带出处（Electron 官方文档 / 本仓 src/shell / 实测可行）：

1. **通知 API**：Electron `Notification` 在 macOS 上的能力与限制——title/body/subtitle、`click` 事件、actions/buttons、`timeoutType`；未打包/未签名 .app（electron-builder 产物，见 scripts/package-mac.mjs 与 ADR 0003）的通知授权行为：bundle id、`app.name`、是否需要用户在系统设置里手动允许、首次弹出的注册时机。
2. **失焦判定**：`app` 的 focus/blur 与 `BrowserWindow` 的 focus/blur、`isFocused()` 的语义差异；启动器模式（.app 为父进程）下窗口生命周期对焦点事件的影响。推荐一套可靠的「壳不在前台」判定。
3. **跨进程通道**：「轮次完成 → 该通知了」从宿主半区（Cordis 进程）到壳主进程怎么走？盘点本仓现有机制：`src/host/spawn-shell.ts`（spawn 与握手）、`DSH_GUI_EXTERNAL_SHELL_DIR` 外部壳握手、`src/shell/main/http-surface.ts`（0.1.5 loopback HTTP surface，见 ADR 0001 修订）——给出 2–3 个候选通道方案及推荐（如复用 http-surface 加内部端点、新增 Unix socket、环境变量+stdio 协议）。
4. **系统行为**：macOS 专注模式/免打扰对 Electron 通知的拦截是系统级的吗（即插件无需自做免打扰）？通知中心堆叠行为确认。

## Answer

报告（逐条带出处）：[research/electron-macos-notification.md](../research/electron-macos-notification.md)

1. **通知 API**：本仓 pin 的 Electron 37（37.10.3）macOS 通知走 NSUserNotification 后端（UNUserNotificationCenter 是 Electron 42+ 才换的，PR #47817）。未签名 .app（bundle id `com.apodemakeles.dsh-gui`，来自 `build.appId`）**无需预先去系统设置**：壳第一次发通知时系统自动弹一次性 "dsh-gui would like to send you notifications" 授权框（触发点 = 设置 NSUserNotificationCenter delegate，与签名无关）；用户点了 Don't Allow 才需要手动去 系统设置 → 通知 → dsh-gui 打开。`click`（banner 主体）可用；`actions` 附加按钮因"App is signed + NSUserNotificationAlertStyle=alert"两个前置条件在未签名形态下**不可用**；`timeoutType` 仅 win/linux；正文 256 字节截断；Electron 前台也弹横幅（delegate 恒 YES），失焦闸门须自做。若将来升 Electron ≥42，通知将要求真实签名——纳入升级核对清单。
2. **失焦判定**：`app` 没有 focus/blur 事件（37 的 d.ts 证实）；宿主 spawn 模式 `app.dock?.hide()` 后 app 级 active 信号不可靠。推荐：client `BrowserWindow` 的 `focus`/`blur` 事件缓存 + 通知时刻 `isFocused()` 快照，`!win.isFocused() && !lastFocused` 即"壳不在前台"；窗口销毁/splash 期一律按后台处理。
3. **跨进程通道**：推荐**壳主进程直连宿主 Unix socket（`fetchOverUnixSocket` 现成工具）订阅宿主 fetch handler 上的 shell 专用 SSE 端点**（如 `GET /dsh-gui-shell/events`，加在官方 exact-route 分派之前）——零新监听面、零新握手（复用 session.json 的 socketPath）、宿主 spawn 与 launcher 两种形态同一条通路；宿主载体的流式 Response 已被 /api SSE 与 remote.mux WS 验证。备选：壳 loopback surface 内部端点（需先解决"端口反告知"，且破坏 ADR 0001 修订版不变式）；spawn stdio NDJSON（两种形态两套实现，耦合 spawn 布局）。
4. **系统行为**：专注模式拦截是**系统级**（interruptionLevel 各档均以 system 为主语；Electron Notification 也没有 time-sensitive 选项），被拦通知静默进通知中心不丢失，插件无需自做免打扰（自查 DND 的私有 API 方案不可靠，不建议）；banner 在右上角纵向堆叠，重复 `show()` 同一实例会撤旧发新。
