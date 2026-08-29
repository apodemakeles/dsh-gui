# ADR 0002 · 功能模块的浏览器半区与 `/api` 伺服

- Status: accepted
- Date: 2026-08-29

## Context

dsh-gui 以「一站式 bundle」交付：功能模块住在 `src/features/<名>/`，由唯一插件入口注册，不建独立插件包。第一个功能模块（token-usage，自 dsh-token-dashboard v0.2.0 移植）带来了两个此前不存在的问题：

1. **本包没有任何浏览器半区**。官方 web client 只加载「宿主 Loader 扫到 `package.json` 声明 `dsh.client` 且 `exports["./client"]` 存在」的包，经 boot 图（`window.__DSH_BOOT__`）以 `/plugins/<id>/client.js` 形式注入。
2. **功能的 snapshot 路由走 `ctx.webServer.register`（node 式 handler），而壳的静默 webServer 从不分发路由**——浏览器侧 `/api/*` 实际都汇于 Unix socket 上的 `connection.createSharedFetchHandler` 组合。

另有一处数据面缺口：源插件的恢复协调器在「上次正常退出」时什么都不做，即**插件不在场期间产生的会话（gui/CLI 使用）永远不会入库**。

## Decision

### 单一 client bundle 组合入口

一个包只有一个 client 半区。`src/client/index.ts` 是组合入口：`inject = ['slots', 'locale']`，`apply()` 逐个调用各功能模块的 `applyXxxClient(ctx)`。新增功能 = 加注册行，**绝不**新增 `dsh.client` 声明或第二个 client 入口。tsdown 的 client 段照搬源插件的闭包工厂配方（cjs + `window.__ModuleLoader__.load({ id: "@apodemakeles/dsh-gui", factory })` banner，外部依赖经冻结模块表的 `require` 解析）。

发现链路零新增：roster 里已有的 `dsh-gui` 行 + package.json 的 `dsh.client` 声明 → `client-modules` 扫描 → boot 图注入 → 协议层把 `/plugins/dsh-gui/client.js` 映射到 `pluginBundles`。

### boot 图的组合 URL

官方 `client-modules` 对插件包固定用组合形式 `/plugins/??<id1>/client.js,<id2>/client.js&rev=<hash>`（单条目也是）。协议层据此解析：逐资源从 `pluginBundles` 解析 → 剥各自 `sourceMappingURL` 尾注 → 以 `;\n` 拼接（与官方 `buildCombo` 语义一致）。任一资源未知则整体 404（官方对未知/过期 rev 同样 404，不伺服部分组合）。组合形式的 `.map` 暂不伺服——缺 map 不影响执行。

### 精确路由表优先的 `/api` 分发

Unix carrier 的处理序：`dispatchExactWebRoute(webServer.exactRoutes(), request) ?? shared.fetch(request)`。功能保持官方姿势在 `ctx.webServer` 上注册 exact 路由（node 式 handler），命中时经 fetch→node 适配器执行（复现 `setHeader`/`writeHead` 合并语义，writeHead 胜出）。这与官方「exact 路由压过 connection 的 `/api` 前缀」优先级一致。

prefix/upgrade/fallback 表保持静默：`/api` 主通道仍是 `createSharedFetchHandler('/api', toFetchHandler(apiProxy))`（保住 ADR 0001 的 426/无 TCP 语义），静态资源仍走协议层。适配器只承诺 GET 式精确路由；官方包若也注册了 exact `/api` 路由，行为从静默 404 变为尝试分发——已知且接受。

### 启动缺口扫描（对源实现的唯一语义增补）

协调器的 clean/ready 分支从「什么都不做」改为缺口扫描：逐会话查 checkpoint，`bootstrapComplete` 为假（从未入库，如 gui/CLI 期间产生的会话）则从 JSONL 补投影；已入库会话只花一次索引查询。幂等批次/checkpoint 语义不变；扫描失败只累加 `failedSessions`、不降级 phase（实时收集不受影响），下次 clean 启动从各自 checkpoint 续扫。数据连续性由此成立：库文件路径不变（`$DSH_HOME/data/token-dashboard/usage-v1.sqlite`），权威数据始终是 `~/.dsh/sessions`。

## Consequences

- token-usage 功能代码与源插件几乎逐字一致（刻意适配仅 5 处：入口导出、Worker `type: 'module'`（node 20 不自动探测 ESM worker）、tsdown 多段配置、inject 合并、缺口扫描），未来可对照源仓 diff 审计。
- `cordis.patch.yml` 零改动——client 半区的发现完全由 package.json 声明驱动。
- 升级 dsh 时新增的排错点：模块表若去掉我们 externals 中的说明符，boot 会响亮失败（`loaded without registering` / require 未命中）；此时把该说明符从 `CLIENT_EXTERNALS` 挪进内联。
- engines 提升为 `node >=22.5.0`（`node:sqlite` 硬需求，与源插件一致）。
