# token-usage 移植决策存档

来源：`github:apodemakeles/dsh-token-dashboard` v0.2.0（commit 对应 0.2.0 tag）。目标：dsh-gui 首个功能模块 `src/features/token-usage/`。规划与取舍的完整叙述见 ADR 0002；本文件记实施期的事实性决策，供日后对照源仓 diff 时查证。

## 刻意适配点（其余逐文件照搬）

1. **入口**：源 `src/index.ts` / `src/client/index.ts` 是插件入口（`export const name/inject/apply`）；移植后改为 `applyTokenUsage(ctx)` / `applyTokenUsageClient(ctx)`，由 `src/index.ts` 的 `apply()` 与 `src/client/index.ts` 组合入口调用。inject 合并为 `['apiProxy','clientModules','webServer','connection','sessions','sessionPersistence']`。
2. **Worker 启动**：`new Worker(url, { type: 'module' })`——dsh-gui engines 曾是 node 20，不能依赖 22 的 ESM 自动探测。`@types/node` 的 `WorkerOptions` 缺 `type` 字段，带 `as never` 绕过（运行时接受）。
3. **tsdown**：单配置对象改四段数组（host 不变；usage-worker/cli 段 `fixedExtension: false` 出 `.js`；client 段闭包工厂配方，banner id 为包名 `@apodemakeles/dsh-gui`，roster 行 id `dsh-gui` 只用于 URL）。
4. **导入扩展名**：全仓 `.ts`/`.tsx` 显式后缀（rolldown node 目标不解析无扩展名相对导入；tsconfig 开了 `allowImportingTsExtensions`）。
5. **缺口扫描**：`init-recovery.ts` 的 clean/ready 分支从「什么都不做」改为 `runGapSweep`（ADR 0002 详述）。这是对源实现唯一的语义增补，动机：gui 期间无收集器在场的会话要补入库。

## 保留不变的外部标识

- SQLite 路径 `$DSH_HOME/data/token-dashboard/usage-v1.sqlite`（数据连续；run-epoch 本就为多 run 共享库设计）。
- 路由 `/api/token-dashboard/snapshot`；locale namespace `token-dashboard`；样式 id `dsh-token-dashboard-styles`。
- CLI 子命令不变，bin 名改 `dsh-gui-token-usage`（避免与旧包 bin 冲突）。

## 依赖与版本

- 新增 devDeps（全部 type-only，运行时由 profile 树/模块表提供）：`@deepseek-ai/dsh-{client-runtime,client-ui-slots,client-ui-sidebar,client-ui-layout,client-locale,session,session-persistence}`，pin `0.1.1-rc.2`（锁文件实际解析线；三个既有运行时依赖仍是 rc.1，属升级前维持现状，不属本次范围）。
- `dsh-client-web-react` / `dsh-client-schema-form` 从源仓 `CLIENT_EXTERNALS` 裁掉：0.1.1 线未发布且本包代码不导入。
- engines `>=20` → `>=22.5.0`（`node:sqlite`）。

## 壳层配套（非移植，属 dsh-gui 基建）

- `src/assembly/web-route-dispatch.ts`：fetch→node 适配 + 精确表分发（`setHeader`/`writeHead` 合并语义）。
- `src/host/webserver.ts`：新增 `exactRoutes()` 只读访问器。
- `src/index.ts`：unix 处理序 = 精确表 → `createSharedFetchHandler('/api', toFetchHandler(apiProxy))`。
- `static-path.ts` / `protocol.ts`：组合 URL `??…&rev=` 解析、尾注剥离、`;\n` 拼接；组合 `.map` 404。

## 验证记录（实施期）

- `pnpm typecheck` / `pnpm test`（92 用例，含 12 个移植文件 + 缺口扫描/dispatch/combo 新用例）/ `pnpm build` 全绿。
- real-sessions 对本机全部会话日志的 last-wins 交叉核对通过（4.5s）。
- 真机验收（首启回填 + verify CLI）见 PR 描述。
