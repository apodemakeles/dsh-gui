# 03 · IPC fetch carrier

Type: task
Status: resolved
Blocked by: 01, 02

## Question

打通「界面请求 → IPC → 宿主」的运输层：

- preload（或 01 结论指定的注入点）实现 `AbstractApiClient` 的子类：只替换 `doFetch`，请求经 `ipcRenderer` 到 main、由 main 转交宿主服务；
- 事件下行（token 流等 WebSocket/WebSocket 形态的通道）在 IPC 上的等价实现——侦察 01 若发现下行不只 fetch，扩展面在此明确；
- 错误与生命周期语义（宿主重启、窗口刷新重连）。

验收：spec 验收标准 1 全量达成——窗口里能看到会话、能发消息并收到流式回复；typecheck/test 绿。

## Answer

- 注入点是 `__DSH_TRANSPORT__`（preload、`contextIsolation: false`）。`createApiClient` 返回只覆盖 `doFetch` 的 `AbstractApiClient` 子类；`doFetch` = 页面 `fetch`，打到 `dsh-gui://` 的 `/api`。
- main 的 `protocol.handle` 把 `/api` 转到 Unix socket 上的 `connection.createSharedFetchHandler('/api', toFetchHandler(ctx.apiProxy))`。包这一层是因为 Typert 远程（插件列表等）登记在 connection 的 interceptor 上，直连 `toFetchHandler` 会 404；SSE 体仍走 fallback 的流式 Response，不经过 connection 挂在 webServer 上那条回 426 的 HTTP 桥，因此不必在 IPC 上再实现 WebSocket。
- 刷新：页面重载后 connection 插件再读 `__DSH_TRANSPORT__` 并重建 generation。宿主进程仍在则 socket 仍在。宿主退出则壳被 kill。
