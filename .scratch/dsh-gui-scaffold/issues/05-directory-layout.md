# 05 · 目录结构方案定稿

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

仓库顶层目录与模块划分定稿。输入：01 的插件规范与本地范本、02 的社区标准、03 的形态、04 的技术栈。要产出：

- 顶层布局图（源码、文档、脚本、CI、预留的插件聚合位置）
- 若 monorepo：workspace 分包边界与命名（@apodemakeles/* 惯例）
- 若独立 App：main/preload/renderer/shared 之外，dsh 桥接层、插件宿主层的位置
- 文档目录（含未来 README.zh、docs/）与目录级占位 README 的取舍
- i18n 取舍：双语 README（本屋惯例）vs README.i18n.yaml（token-dashboard 机制，01 报告已记录其工作方式）vs 应用内多语言——至少定 README 层面的做法

## Comments

- 2026-08-27 · 03 号票定型输入：pnpm workspace monorepo——`apps/` 放 Electron 壳（预留独立 .app 之路），`packages/` 放 bundle 与未来功能插件；既有插件不收编。**新增待解子问题**：bundle 包的安装路径——根 package.json 即 bundle vs workspace 子包 + pnpm git 依赖 `#path` 子路径安装（官方文档只演示了仓库根安装，子路径未验证）；grilling 时先验证再定顶层布局。
- 2026-08-27 · 04 号票定型输入：壳工程照抄 agent-connector 工具链——electron-vite 三目标（main/preload/renderer）+ electron-builder（`release/` 出产物），React 渲染层；`apps/` 下壳包的内部形态直接采用其 main/preload/renderer/shared 四目录结构。

## Answer

（2026-08-28 grilling 落定，含本机实证。）

**先记录验证**（为「bundle 放哪」做的三连实证，全部本机完成、现场已清理）：
1. pnpm 11.21 支持 git 依赖子路径安装：`git+file://…#path:packages/sub` 装进的是子包；
2. `dsh plugin --profile <scratch> add <同 spec>` 原样转发 pnpm、正常装入；
3. 子包声明 `dsh.bundle` 后真实激活：登记进 `dsh.profile.bundles`，`--dump-config` 合成树出现 patch 行。
→ 子路径路线可行但**未采用**（原因见下），留作未来拆独立包时的备用路径。

**本票最重要输入（用户需求修正）**：dsh-gui 一站式交付——用户无按功能选择安装的粒度；要求「开发上一个子功能一个文件夹、安装上一个包全带走」。由此：
- 「功能 = 独立插件包」模型作废（CONTEXT.md 的「功能插件」已改为「功能模块」）；03 的 monorepo 结论被本票细化为**单包仓库**——一个 `apply()` 注册全部功能，官方 web-app bundle（patch 多行、交付一体）即此形态先例。

**定案布局（单包仓库）**：

```
dsh-gui/
├── package.json          # 根 = 唯一安装包（dsh.bundle.patch、peerDeps pin、engines）
├── cordis.patch.yml
├── README.md / README.zh.md / LICENSE / CONTRIBUTING / AGENTS.md / .gitignore
├── .github/              # issue/PR 模板 + ci.yml + release.yml
├── docs/                 # adr/ + images/
├── CONTEXT.md
└── src/
    ├── index.ts          # 唯一插件入口：apply() 注册全部功能模块
    ├── shell/            # Electron 壳（main/preload/renderer/shared 四目录）
    └── features/         # 每个子功能一个文件夹（未来重做的功能在此生长）
```

**安装**：`dsh plugin --profile gui add github:apodemakeles/dsh-gui`（与既有插件发布同构）。

**随带定案**：README 双语互链；`docs/` 只放 adr/ 与 images/；`src/` 子目录不放占位 README（目录导航归 AGENTS.md）。

**留给设计阶段的已知待解**（不阻塞脚手架）：官方 web client 构建产物在用户机器上的定位方式（随 dsh 安装存在，装配模块从宿主侧解析）。
