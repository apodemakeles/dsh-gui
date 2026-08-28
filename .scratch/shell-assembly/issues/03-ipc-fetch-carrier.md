# 03 · IPC fetch carrier

Type: task
Status: open
Blocked by: 01, 02

## Question

打通「界面请求 → IPC → 宿主」的运输层：

- preload（或 01 结论指定的注入点）实现 `AbstractApiClient` 的子类：只替换 `doFetch`，请求经 `ipcRenderer` 到 main、由 main 转交宿主服务；
- 事件下行（token 流等 WebSocket/WebSocket 形态的通道）在 IPC 上的等价实现——侦察 01 若发现下行不只 fetch，扩展面在此明确；
- 错误与生命周期语义（宿主重启、窗口刷新重连）。

验收：spec 验收标准 1 全量达成——窗口里能看到会话、能发消息并收到流式回复；typecheck/test 绿。
