# ADR 0001 · 自定义协议加载官方 web client

- Status: accepted
- Date: 2026-08-29

## Context

官方叙事要求 Electron 用 `file://` 加载 web client 构建产物，fetch 走 IPC，不复用 `dsh-host-webserver` 的 TCP 端口。实测 `@deepseek-ai/dsh-web-frontend` 的 `dist/index.html` 使用根绝对路径（`/assets/...`、`/plugins/<id>/client.js`）。`file://` 加载该 HTML 时，`/assets/...` 会解析到文件系统根而不是 dist 目录，页面无法启动。

`window.__DSH_BOOT__` 与 parser-blocking 的 `/plugins/...` classic script 同样依赖「有 origin 的页面」。`file://` 的 origin 为 `null`，官方 client 的 loopback 判定与模块加载都会失败。

## Decision

使用特权自定义协议 `dsh-gui://127.0.0.1/` 作为 `file://` 的等价替代：

- 无 TCP 端口；静态文件从磁盘读。`/api` 经 Unix socket 交给 `connection.createSharedFetchHandler`：Typert 远程方法走 interceptor，会话 RPC 与 SSE 下行（`events.mux` / `events.host`）走 `toFetchHandler`。不要把 Unix 桥接到 connection 挂在 `webServer` 上的 HTTP 路由——那条路由对事件 GET 回 426（留给浏览器 WebSocket）。
- hostname 为 `127.0.0.1`，官方 client 把页面视为 loopback，特权方法（设置、凭据、选目录）可用。
- `window.__DSH_TRANSPORT__` 只提供 `createApiClient`（`AbstractApiClient` 子类，仅换 `doFetch`）与 `fetch`。事件下行走基类 SSE（`readSse`），不走 WebSocket。

## Roster 内联与升级策略

本仓库 `cordis.patch.yml` 内联了官方 `packages/bundle/web-app/cordis.patch.yml` 的 438 行 roster，为的是 `dsh plugin --profile gui add` **一条命令装齐** web 表面，而不要求用户再装 `@deepseek-ai/dsh-web-app`。gui 特有的替换叠在同一文件里：静默 `webServer`、`openBrowser: false`、以及拉起 Electron 的 `dsh-gui` 行。

这是一份会漂的副本。官方 roster 随 dsh 发布增减行、改 inject、改默认 config。**每次升级 dsh（含 rc pin）之前必须**：

1. 取出该版本的 `packages/bundle/web-app/cordis.patch.yml`（发布包内或上游仓库同路径）；
2. 与本仓库 `cordis.patch.yml` 做 diff；
3. 把官方新增/删除/改写的行同步进来，再手工保留 gui 的三处替换（静默 webserver、不开浏览器、`dsh-gui` 行）。

漏同步的典型后果是设置页缺插件、Typert 远程 404、或 inject 对不上而宿主起不来。

## Consequences

- 窗口加载路径不经过 HTTP 端口，满足里程碑验收标准 3。
- `client-modules` / `connection` 仍注入名为 `webServer` 的 Cordis 服务；gui 提供不 listen 的替身，避免为了满足 inject 去绑 3080。
- 官方 dist 升级后若仍用根绝对路径，本决策继续成立；若改为相对路径，可再评估回到 `file://`。
