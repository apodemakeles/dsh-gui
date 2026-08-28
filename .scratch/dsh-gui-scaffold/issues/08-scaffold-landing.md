# 08 · 骨架落地

Type: task
Status: resolved
Blocked by: 05, 06, 07

## Question

把前序决策变成仓库里真实的文件并完成初始提交（本 effort 携带执行的终点票）：

- LICENSE（MIT，本屋惯例）、README.md + README.zh.md、CONTRIBUTING、`.github/`（issue/PR 模板 + CI 骨架 + release workflow 骨架——deepseek-vision 的 ci.yml/release.yml 可整套复用）、.gitignore（06 定稿）
- 工程骨架（05 定稿的单包布局）：根 package.json（`dsh.bundle.patch`、peerDeps pin、engines、scripts）+ cordis.patch.yml + tsconfig + electron.vite.config.ts + tsdown.config.ts + `src/{index.ts、shell/（main/preload/renderer/shared）、features/}`
- AGENTS.md（07 定稿的八节大纲，中文撰写）
- git 初始提交：默认分支定名 `main`（当前空仓库在 master 上）；`.scratch/` 与 CONTEXT.md 随库入库（06 定稿）
- 验收：`ls` 顶层与图一致；CI 骨架可跑；AGENTS.md 命令可执行

## Answer

（2026-08-28 落地完成，验收全绿。）

**落地物**（21 个入库路径）：

- 根：package.json（`@apodemakeles/dsh-gui` v0.1.0；`dsh.bundle.patch`；peerDeps pin cordis；electron 生产依赖；`prepare` = build；electron-builder 的 `extraMetadata.main` 解决插件入口/壳入口双 main 冲突）、`cordis.patch.yml`（id: dsh-gui，头部带安装命令注释）、`.gitignore`（06 定稿清单 + lib/）、`pnpm-workspace.yaml`（allowBuilds：electron/esbuild/electron-winstaller）、`.editorconfig`、`tsconfig.json`
- 文档：LICENSE（MIT）、README.md + README.zh.md（双语互链，状态如实标注 scaffolding）、CONTRIBUTING.md、SECURITY.md、AGENTS.md（八节中文，07 大纲）、CONTEXT.md
- `.github/`：ci.yml + release.yml（照抄 vision 成品）、bug-report.yml、config.yml、PR 模板、release.yml（自动 notes 排除 chore）
- 骨架：electron.vite.config.ts（三目标 + renderer 显式 input）、tsdown.config.ts（outDir lib/）、`src/{index.ts、shell/{main,preload,renderer,shared}、features/}`、`test/plugin-shape.test.ts`、`docs/{adr,images}/`

**验证**：`pnpm install`（Electron 二进制与全部 postinstall 通过）→ `pnpm build`（out/ 三目标 + lib/index.mjs + index.d.mts）→ `pnpm typecheck` ✓ → `pnpm test` ✓（1 passed）。

**落地中发现并修复的三件事**：

1. electron-vite v4 的 renderer 配置**强制显式** `build.rollupOptions.input`（默认 root 找不到 index.html 才报错的文案有误导性，实际是无条件要求）；
2. tsdown 0.22 默认输出 `dist/`、`external` 选项已废弃 → 显式 `outDir: 'lib'`，peerDependencies 自动外置；
3. pnpm v11 构建脚本白名单只认 `pnpm-workspace.yaml` 的 `allowBuilds`（package.json 的 `pnpm` 字段已死）——与 dsh 官方文档的 allowBuilds 术语一致。

**git**：默认分支 master → **main**，全部入库（含 `.scratch/` 与 CONTEXT.md，06 决定），初始提交 `chore: initial scaffold (wayfinder decisions 01-08)`。
