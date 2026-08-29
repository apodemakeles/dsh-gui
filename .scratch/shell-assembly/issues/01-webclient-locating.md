# 01 · 侦察：web client 产物定位与装配设计

Type: research
Status: resolved

## Question

读 deepseek-harness 源码（apps/web、packages/host/webserver、packages/client/modules），回答 spec 的三个开放问题：

1. `dsh web` 场景下发给浏览器的 web client 构建产物在磁盘上的位置；Electron 壳如何定位/获取（宿主服务？dsh 安装目录约定？）。
2. `window.__DSH_BOOT__` 引导图与 `/plugins/<id>/client.js` 在 file:// 场景的等价物怎么生成。
3. `AbstractApiClient` 的 doFetch 在官方 client 代码中的注入/替换点（externals 白名单是否允许外部子类）。

产出：结论写回本 issue 的 `## Answer`（带源码出处路径）；若与官方叙事有出入（如必须开端口/必须 HTTP），如实记录并给出取舍建议 + 是否值得 ADR。**本票只侦察不写实现代码。**

## Answer

（2026-08-29，对照本机 dsh `0.1.1-rc.1` 已发布包，等价于官方 `apps/web` / `packages/host/webserver` / `packages/client/modules`。）

### 1. 产物位置

`dsh web` 的静态页来自 npm 包 `@deepseek-ai/dsh-web-frontend`（仓库 `apps/web`，`package.json#repository.directory`）。`dsh-web-app` 用 `require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')` 定位，**不是**用户配置、也不是宿主 HTTP 返回的路径。Electron 侧用同一 resolve（安装树或 profile 的 `node_modules` 上溯）。本插件：`src/assembly/web-client-dist.ts`。

官方 dist 的 `<script>`/`<link>` 是根绝对路径 `/assets/...`。裸 `file://` 无法加载。等价替代：特权协议 `dsh-gui://127.0.0.1/` 把 `/assets` 映射到 dist 根。见 [ADR 0001](../../docs/adr/0001-custom-protocol.md)。

### 2. `__DSH_BOOT__` 与 `/plugins`

`dsh-client-modules` 扫描 Loader 里带 `dsh.client` 的包，组成 `WebBootGraph`，经 `webserver/index-inject` 写成：

- 内联 `__ModuleLoader__` 队列脚本
- parser-blocking `<script src="/plugins/<id>/client.js?rev=...">`（modules + runtime）
- `globalThis.__DSH_BOOT__ = graph`

出处：`@deepseek-ai/dsh-host-webserver/lib/types/injections.d.ts`（`renderIndexInjections` / `IndexInjection`）；官方仓 `packages/host/webserver`。

file:// 没有这份注入。做法：宿主在拉起壳之前调用 `webServer.renderIndex(rawIndex)`（同一套 injection 表），把结果写成临时 `index.html`；协议把 `/plugins/<id>/client.js` 映射到 `clientModules.clientPath(id)`。不需要 HTTP 去取 bundle。`__DSH_TRANSPORT__.loadBundle` 不必实现。

### 3. doFetch 注入点

不要 fork 官方 client，也不要靠 externals 白名单塞子类。官方注入点是页面全局 `__DSH_TRANSPORT__`（`ClientTransportHooks`）：

- 出处：`@deepseek-ai/dsh-client-connection/lib/types/client/index.d.ts`（`ClientTransportHooks`）；client 半区读取 `globalThis.__DSH_TRANSPORT__`（`lib/client.js`）。官方仓 `packages/client/connection`。
- `createApiClient()` → 自备 `IApiClient`（官方例子：worker 预览的 postMessage 隧道）
- `fetch` → Typert 通用 RPC
- 可选 `loadBundle`

`AbstractApiClient` 只要求子类实现 `doFetch`（`@deepseek-ai/dsh-host-apiproxy/lib/types/fetch/client.d.ts` 约 L127）；默认 `openMux`/`openHost` 走 SSE `readSse`（同文件约 L163）。浏览器子类 `WebApiClient` 才把下行换成 WebSocket。Electron 提供「只换 doFetch」的子类即可，事件流经同一 fetch 运输层。

宿主侧同构点是 `toFetchHandler(ctx.apiProxy)`（`@deepseek-ai/dsh-host-apiproxy/lib/types/fetch/handler.d.ts`）。Typert 远程（如 `pluginInventory/list`）登记在 connection 的 `/api` interceptor 上，**直连** `toFetchHandler` 会 404。因此 Unix 桥接到 `connection.createSharedFetchHandler('/api', toFetchHandler(ctx.apiProxy))`：interceptor 命中的走 connection，其余（会话 RPC、SSE `events.mux` / `events.host`）回落到 `toFetchHandler`。不要把 Unix 桥接到 connection 挂在 webserver 上的 HTTP `/api`：它对 `GET /api/events.*` 回 426（留给浏览器 WebSocket），而壳的 `AbstractApiClient` 用 SSE。

### 进程拓扑

`dsh --profile gui` 已在 Node 里 `startHost()`。插件 `apply()` 拉起 Electron 子进程；宿主退出则杀壳，窗口全关则壳退出并结束宿主进程。不在 Electron 主进程里再 `startHost()`。

### 是否值得 ADR

是：自定义协议 vs 叙事中的 `file://`，见 ADR 0001。
