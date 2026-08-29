# dsh-gui

dsh 的桌面壳：以 dsh 插件（bundle）身份交付的 Electron 应用，通过名为 gui 的 profile 被 dsh 拉起，复用 dsh 的宿主与 web client，不重写核心功能。单包一站式交付：全部功能模块随一个包安装，用户无按功能选择的粒度。

## Language

**壳（Shell）**:
dsh-gui 的 Electron 应用部分——主进程与渲染进程，用 `dsh-gui://` 加载官方 web client（ADR 0001），提供原生桌面能力。
_Avoid_: App、客户端（App 留给未来可能的独立 .app 形态）

**gui profile**:
用户机器上名为 gui 的 dsh 插件组合，bundle 清单中含 dsh-gui；启动命令是 `dsh --profile gui`。
_Avoid_: 桌面 profile、desktop profile

**dsh-gui bundle**:
本仓库对外安装的插件包身份：一个 surface bundle，宿主里的插件负责拉起壳。
_Avoid_: 壳插件（易与壳内代码混淆）

**IPC fetch carrier**:
渲染进程与宿主之间的运输层：`AbstractApiClient` 的子类只替换 `doFetch`。桌面实现里页面同源 `fetch` 打到 `dsh-gui://`，main 经 Unix socket 交给 `connection.createSharedFetchHandler('/api', toFetchHandler)`（无 TCP 端口）。Typert 远程走 interceptor，会话 RPC 与 SSE 走 fallback；不使用 connection 挂在 webServer 上的 HTTP `/api`（事件 GET 会 426）。
_Avoid_: IPC 桥（泛称）

**功能模块**:
一站式交付的子功能：住在 `src/features/<名>/` 的源码文件夹，由唯一插件入口统一注册，不是独立可安装的 dsh 插件；用户无按功能选择安装的粒度。
_Avoid_: 功能插件（暗示可单独安装）、旧插件迁移（本项目不做迁移）

**浏览器半区组合入口**:
`src/client/index.ts`：本包唯一的 client bundle（`exports["./client"]` + `dsh.client`），所有功能模块的 UI 都注册进它；一个包不可能有第二个浏览器半区。
_Avoid_: 客户端插件、client 插件

**缺口扫描**:
token-usage 在 clean 启动时对会话日志做的补投影：把没有任何收集器在场期间（如仅 gui/CLI 使用）产生的会话补进 SQLite；权威数据始终是 `~/.dsh/sessions`，库是可重建投影。
_Avoid_: 数据迁移（不搬数据，库文件路径不变）

**启动器模式**:
打包 .app 的运行形态：进程树反转为「.app 为父、宿主为子」，经 `DSH_GUI_EXTERNAL_SHELL_DIR` 握手（宿主把 session 写进指定 run 目录且不再自己 spawn Electron）。功能本体仍是 dsh 插件，.app 只是入口皮。
_Avoid_: 独立应用（暗示脱离插件机制）、双击启动（口语可，正式文档用启动器模式）

**外部壳**:
宿主视角对启动器模式的称呼：壳已在场、由它拉起本进程。宿主侧分支只写握手文件与监听 socket；dispose 只删自己写的三个文件（不 rm -rf 调用方目录）。
_Avoid_: 宿主外置（语义不明）
