# ADR 0003 · 独立启动器 .app 与进程树反转

- Status: accepted
- Date: 2026-08-29

## Context

v0.2.x 的唯一入口是终端命令 `dsh --profile gui`：宿主（cordis 进程）为父，插件在 apply() 里 spawn Electron 壳为子；窗口关闭时壳退出、宿主随之 `process.exit`。对桌面用户这不自然——想要的是 Dock 里的一个图标，点击即用，关窗即全退。

仓库已有 `pnpm package:mac`（electron-builder，dir target，arm64），但产物双击只会看到开发占位窗口：它不会启动宿主。同时，分发语义必须澄清：**.app 不是功能本体**。全部功能（宿主逻辑、client 半区、token 面板）仍由 dsh 插件机制安装与更新；.app 只是「图标 + 启动器 + 窗口壳」这层皮。

## Decision

### 进程树反转：.app 作为父进程拉起宿主

打包 .app 无 session 环境变量时进入启动器模式（`src/shell/main/launcher.ts`）：定位 dsh CLI（`DSH_GUI_DSH_BIN` 覆盖 → `/opt/homebrew/bin`、`/usr/local/bin`、`~/.dsh/bin` 探测——Finder 启动没有用户 PATH）、以 `DSH_GUI_EXTERNAL_SHELL_DIR=<run 目录>` spawn `dsh --profile gui`（stdio 落 `userData/logs/host.log`）、轮询握手、就绪后加载正式 client 窗口。

宿主侧对应该 env 的分支：跳过 `resolveShellPaths` 与 Electron spawn，session/socket/index 写入指定 run 目录（`session.json` 经 tmp+rename 原子发布，启动器不会读到半截）；dispose 只删自己写的三个握手文件，**不** `rm -rf` 调用方目录。另设孤儿看护：外部壳模式下每 5s 检查 `ppid === 1`（.app 被强杀、宿主被 reparent 给 launchd）即退出，不留无头宿主。

关窗语义两侧闭合：壳侧 `SIGTERM` 宿主（5s 超时升级 `SIGKILL`）后 `app.exit`；终端模式维持原样（宿主 watch 壳退出）。单实例锁只在启动器分支申请，不影响终端双开。

启动期间显示双语 splash（含失败态：dsh 未找到 / 宿主启动中退出 / 120s 超时，附日志路径）；宿主就绪前 socket 探活（`net.connect` 成功才开窗）。

### 双产物分发：插件是本体，.app 是入口皮

- **功能层（必经）**：`dsh plugin --profile gui add github:apodemakeles/dsh-gui`，与 v0.1.x 相同。功能迭代全部走插件更新，.app 不用动——它与宿主的接口只有 session JSON 契约（`src/assembly/session.ts`），保持向后兼容。
- **入口层（可选）**：release workflow 在 macOS runner 上 `pnpm package:mac`，`ditto` 打 zip 挂 GitHub Release。用户下载一次拖进 `/Applications`；后续日常只剩点图标。

**不签名不公证**（个人自用决策）：本机构建的 .app 无隔离标记、双击直开；从网上下载的首次打开需在系统设置放行一次（受众是 dsh 用户，可接受）。若将来分发给更广用户，补 Developer ID 签名 + 公证只是打包配置增量。

### electron-builder 的隔离打包（staging 方案）

electron-builder 无法直接面对本包：它拒绝 `dependencies.electron`（而 dsh 插件安装**必须**靠它让宿主 `require('electron')` 拿到二进制），其「收集生产 node_modules」步骤还会按临时摘除后的 manifest 重写 lockfile 并 prune electron。因此 `scripts/package-mac.mjs` 在**仓库外的系统临时目录**组装 staging 项目（最小 manifest + build 配置从主 package.json 克隆、output 指回 `release/` + `out/` 副本），以 `--config.electronVersion=<本地精确版本>` 与 `--config.npmRebuild=false` 运行。staging 在仓库外是刻意的：electron-builder 会向上搜索 pnpm-lock.yaml，在仓库内会捞到宿主侧生产依赖（1GB）塞进壳的 asar。产物 asar 只含 `out/`。

## Consequences

- 用户机器上存在两份 Electron（.app 内嵌一份、插件 node_modules 一份），各服务一个入口，磁盘代价 ~250MB，接受（后续如收敛需重估终端模式）。
- .app 与插件版本可能错位：靠 session 契约向后兼容承诺兜底；壳侧协议/握手逻辑变更时用户需重新下载 .app（低频）。
- 宿主日志从终端迁移到 `~/Library/Application Support/dsh-gui/logs/host.log`（终端模式仍是 inherit）。
- CI 的 release job 从 ubuntu 换到 macos-latest（原生打 arm64 dir 包，交叉打包风险消除）。
