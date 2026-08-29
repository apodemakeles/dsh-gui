# 02 · apply() 拉起 Electron 壳

Type: task
Status: resolved
Blocked by: 01

## Question

把 `src/index.ts` 的 stub 变成真的 surface 插件：

- `apply(ctx)` 定位并启动 Electron（`electron` 依赖的二进制路径解析；开发态 vs 安装态两种运行方式）；
- 壳进程生命周期与 profile 绑定（宿主退出 → 壳退出；窗口全关 → ？与 01 的拓扑结论一致）；
- main 进程按 01 的结论加载 web client（file:// 或论证过的替代路线），占位 renderer 退场；
- 开发闭环：`pnpm dev` 不经过 dsh 也能起壳调 UI（或不做，说明理由）。

验收：`dsh --profile gui`（本地安装）开窗显示 web client 静态界面（无 carrier 时的降级形态）；typecheck/test 绿。

## Answer

- `apply()` 在 `apiProxy` / `clientModules` / `webServer` 就绪后：渲染带 `__DSH_BOOT__` 的 index、在 Unix socket 上挂 `toFetchHandler`、spawn `electron out/main/index.js`。
- 宿主 dispose → kill 壳；窗口全关 → Electron quit → 宿主 `process.exit`。不在 Electron 里再 startHost。
- 加载路线是 `dsh-gui://127.0.0.1/`（ADR 0001），不是裸 file://。有 session 时占位 renderer 不加载。
- `pnpm dev` 仍走占位页：`__DSH_BOOT__` 与 apiProxy 只在活宿主里存在，假 boot 图会误导。调 UI 用 `dsh --profile gui`。
