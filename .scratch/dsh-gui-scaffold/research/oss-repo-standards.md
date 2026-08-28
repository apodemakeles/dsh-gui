# 调研 · 开源桌面应用仓库社区标准

- 调研日期：2026-08-21
- 服务对象：`dsh-gui`（Electron/Tauri 二选一未定的桌面 GUI，单人维护 + AI agent 协作，公开发布在 GitHub，仓库当前零提交）
- 方法：作者既有仓库本地实读 + 官方文档一手核对（GitHub Docs、semver.org、Keep a Changelog、changesets、release-please、electron-builder、Tauri v2、trunkbaseddevelopment.com、Cargo Book、pnpm 官方文档）+ GitHub API 拉取官方脚手架模板与高 star 桌面应用的真实文件布局与 Release 产物。
- 标注约定：【权威】= 权威来源明说；【惯例】= 同类项目/模板实际做法推断；作者惯例 = 本地仓库实读。

---

## TL;DR

1. **LICENSE 用 MIT**。作者两个插件仓库（token-dashboard、deepseek-vision）都是 `MIT License, Copyright (c) 2026 apodemakeles`；agent-connector 没有 LICENSE 是反面教材——无许可证默认"保留所有权利"，他人无法合法使用（【惯例】，本地实读）。
2. **README 双语（README.md + README.zh.md）是作者既有惯例**，英文版结构遵循 GitHub 官方建议：项目做什么 / 为什么有用 / 如何上手 / 在哪获得帮助 / 谁在维护，截图放前部（【权威】GitHub Docs + 作者仓库实读）。
3. **社区健康文件放置规则**：README/CONTRIBUTING/SECURITY 等可放 `.github/`、根目录或 `docs/`，优先级 `.github` > 根 > docs；**issue 模板必须**在 `.github/ISSUE_TEMPLATE/`；也可以用账号级 `.github` 公共仓库做默认文件，但** LICENSE 不能用这种方式下发**（【权威】GitHub Docs）。
4. **单人项目的 `.github/` 最小集**：一个 CI workflow + 一个 bug 报告 yaml 表单 + config.yml + dependabot.yml。CoC、PR 模板、FUNDING 按需；feature 模板等有外部贡献者后再加（【惯例】+ Pake/Joplin 实际布局佐证）。
5. **发布最小可行组合 = semver tag + GitHub 自动生成 Release Notes + 构建产物上传**。作者 deepseek-vision 已有可整套复用的 `release.yml`（tag `v*` 触发 + `softprops/action-gh-release@v2` + `generate_release_notes: true`）；changesets 面向 monorepo 发 npm，release-please 依赖 Conventional Commits 纪律，单人首期都不必上（【权威】各工具自述 + 作者仓库实读）。
6. **桌面产物惯例**：Electron 侧 dmg/pkg/zip+`latest*.yml`+`.blockmap`（electron-updater 消费）；Tauri 侧 dmg/msi/AppImage + 开启 updater 时附带 `latest.json` 与 `.sig` 签名文件（【权威】electron-builder / Tauri 官方文档，Joplin 真实 Release 产物佐证）。
7. **分支模型选 GitHub Flow（= 单主干 trunk-based + PR）**：main 为唯一长命分支，agent 在短命分支（`feature/*`、`agent/*`、`research/*`）上工作，squash merge 回 main、删分支、打 `v*` tag 发布；不要 develop/release 长命分支（【权威】trunkbaseddevelopment.com、GitHub Flow Docs、Driessen 2020 反思）。
8. **两套 .gitignore 都已整理好**（见第 4 节），核心差异：Electron 侧要忽略 `out/`+`dist/`+`release/`；Tauri 侧要忽略 `src-tauri/target/`、`src-tauri/gen/schemas`，且 **Cargo.lock 要提交**（【权威】github/gitignore 官方模板、create-tauri-app/create-electron 官方模板、Cargo Book）。
9. **CI 最小骨架 = lint + typecheck + test + build**，作者 deepseek-vision 的 ci.yml 就是标准写法；2026 年注意：pnpm v11+ 官方推荐从 `pnpm/action-setup@v4` + `actions/setup-node` 迁移到新的 `pnpm/setup` 单步骤 action（【权威】pnpm 官方文档 + action-setup README）。
10. **2026 年新惯例：AI 协作文件成为标配**。高 star 仓库普遍出现 `AGENTS.md` / `CLAUDE.md`（Pake、Spacedrive、SiYuan、Joplin 都有），dsh-gui 应在第一天就规划（【惯例】，GitHub API 实查）。

---

## 0. 作者既有仓库的实际惯例（本地实读）

| 维度 | dsh-token-dashboard | dsh-deepseek-vision | agent-connector（Electron） |
|---|---|---|---|
| LICENSE | MIT, (c) 2026 apodemakeles | MIT, (c) 2026 apodemakeles | **缺失** |
| README | README.md + README.zh.md（首行互链 `English | [中文](README.zh.md)`）；小节：Screenshots → What it does → Installation → Data and operations → Development → Known limitations → License | README.md + README.zh.md；小节：Install → Configure → Behavior → Develop → License | 仅中文 README.md |
| 包管理 | pnpm（lock + pnpm-workspace.yaml） | pnpm，`packageManager: pnpm@11.21.0` | npm（package-lock.json） |
| 构建/测试 | tsdown + vitest，`typecheck` 脚本 | tsdown + vitest，`typecheck` 脚本 | electron-vite + electron-builder + vitest，`typecheck` 脚本 |
| CI | 无 | `.github/workflows/ci.yml` + `release.yml` | 无 |
| 分支 | main 默认 + `feature/*`、`prototype/*`、`research/*` 短命分支；tag `v0.1.0`、`v0.2.0`；无 merge commit（squash/rebase 风格） | 仅 main | 默认分支为 `dev`（偏离主流） |
| .gitignore | node_modules/、*.tsbuildinfo、.DS_Store、.playwright-cli/ | node_modules/、lib/、coverage/、*.tsbuildinfo、.DS_Store | node_modules/、out/、release/、.DS_Store、*.log |

来源：`/Users/caozheng/github/apodemakeles/dsh-token-dashboard/{LICENSE,README.md,package.json,pnpm-workspace.yaml,.gitignore}`、`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/{LICENSE,README.md,package.json,.gitignore,.github/workflows/ci.yml,.github/workflows/release.yml}`、`/Users/caozheng/github/apodemakeles/agent-connector/{package.json,.gitignore,README.md}`（git 分支/tag 经 `git branch -a` / `git tag` 实查）。

作者现成的 CI/Release workflow 全文（可直接抄给 dsh-gui）见：
- `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/.github/workflows/ci.yml`（push main + PR → checkout → pnpm/action-setup@v4 → setup-node@v4 cache:pnpm → `pnpm install --frozen-lockfile` → typecheck → build → test）
- `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/.github/workflows/release.yml`（push tags `v*` → 全量校验 → `softprops/action-gh-release@v2` + `generate_release_notes: true`）

---

## 1. 文件集标准

### 1.1 README

【权威】GitHub Docs「About READMEs」给出 README 应包含的五要素，原文为 "typically include information on: What the project does / Why the project is useful / How users can get started with the project / Where users can get help / Who maintains and contributes"。其他要点：

- 放置与优先级：GitHub 识别 `.github` 目录、仓库根目录、`docs` 目录中的 README，**优先级为 `.github` → 根 → `docs`**；单仓库通常直接放根目录。
- 大小上限：README 超过 **500 KiB** 部分在 GitHub 页面被截断；GitHub 会依据标题自动生成大纲（outline）。
- 内容纪律："A README should only contain information necessary for developers to get started"，长文档放 wiki/docs 目录。
- 来源：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes

桌面应用 README 的通行小节结构（【惯例】，综合作者 token-dashboard 的 README 与 Pake/Joplin/SiYuan 实际 README 推断）：

1. 一句话定位 + 状态徽章/版本（badges：CI 状态、license、release 版本——Pake、Joplin 均用 shields.io 徽章）
2. 截图/GIF（桌面应用尤其重要；作者 token-dashboard 把 Screenshots 放第二节）
3. 安装与快速上手（含各平台安装包矩阵 + 从源码运行）
4. 功能概览
5. 开发指南（dev/test/build）
6. 贡献指引（链接 CONTRIBUTING）
7. License（注明与 LICENSE 文件一致）
8. 双语：作者惯例是 `README.md`（英）+ `README.zh.md`（中）首行互链；Pake（README.md + README_CN.md）、SiYuan（多语言 README）同款做法。

### 1.2 LICENSE

- 【权威】GitHub 开源指南（Open Source Guides / Docs「Setting up your project for healthy contributions"）把 license 列为鼓励贡献的基础文件；GitHub Docs 明确 license 不能通过账号级 `.github` 默认仓库下发，每个仓库必须自带。
- 【惯例】作者既有仓库用 **MIT**（dsh-token-dashboard、dsh-deepseek-vision 的 LICENSE 文件均为标准 MIT 文本，`Copyright (c) 2026 apodemakeles`）。dsh-gui 沿用 MIT 最顺；注意 agent-connector 没放 LICENSE，属于应当修正的缺口。
- 参考样本许可证取向（GitHub API 实查，2026-08）：Joplin 自定义许可（NOASSERTION）、SiYuan AGPL-3.0、Pake GPL-3.0、Spacedrive 自定义。**流行 ≠ 适合**：单人工具型桌面应用选 MIT/Apache-2.0 的维护成本最低，GPL 系适合不希望被闭源分发的场景。

### 1.3 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / CHANGELOG 按规模取舍

【权威】依据 GitHub Docs，这些文件计入仓库的社区资料（community profile），可放 `.github/`、根或 `docs/`，优先级 `.github` → 根 → `docs`（issue 模板除外，见 1.4）。

| 文件 | 官方定位 | 单人项目建议 |
|---|---|---|
| CONTRIBUTING.md | GitHub Docs："communicate how people should contribute"（怎么跑测试、PR 流程、代码规范） | 【惯例】即使单人也值得写一份**简短的**——因为 AI agent 也是"贡献者"，把 dev/test/typecheck 命令与分支约定写给 agent 看收益极高。Joplin/Pake/Spacedrive 顶层均有。 |
| CODE_OF_CONDUCT.md | GitHub Docs：行为准则、欢迎信号 | 【惯例】对外贡献者出现前优先级低；样本中 Pake/Spacedrive 有，Joplin 顶层无。要加就直接用 Contributor Covenant 模板。 |
| SECURITY.md | GitHub Docs：内容为"supported versions + how to report a vulnerability"，在仓库 Security tab 展示 | 【惯例】桌面应用分发二进制，用户有理由关心；一份 5 行的"私下报告渠道 + 支持版本"即可。Joplin、Spacedrive 均有。 |
| CHANGELOG.md | Keep a Changelog：面向人的变更记录，推荐文件名 CHANGELOG.md，顶部保留 Unreleased，类型 Added/Changed/Deprecated/Removed/Fixed/Security | 【惯例】见第 2 节：单人可用 GitHub Releases 自动 notes 替代独立文件；要维护文件就按 Keep a Changelog 格式。SiYuan 有 CHANGELOG.md，Pake 无（用 GitHub Releases）。 |
| SUPPORT.md | GitHub Docs：获取帮助的渠道 | 可选，README 的"Where users can get help"一节可覆盖。 |

来源：https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions 、https://keepachangelog.com/en/1.1.0/ 、SECURITY.md 内容要求见 https://docs.github.com/en/enterprise-server@3.19/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy （com 版对应文章当前 404，企业版文档同文）。

### 1.4 `.github/` 社区健康文件

【权威】放置规则（GitHub Docs「Creating a default community health file」）：

- 通用规则：CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、SUPPORT、FUNDING.yml、GOVERNANCE 等 "may be in the root of the repository, the `.github` folder, or the `docs` folder"，查找顺序 `.github` → 根 → `docs`。
- **Issue 模板及其 config 必须位于 `.github/ISSUE_TEMPLATE/`**；若仓库自备了任何 issue 模板，账号级默认模板整套失效。
- 账号级默认：公开的 `.github` 仓库中的默认文件适用于该账号下未自备该文件的仓库；**license 除外**。
- FUNDING.yml：必须在 `.github/FUNDING.yml`（默认分支），支持 github/patreon/open_collective/ko_fi/buy_me_a_coffee/custom 等平台。来源：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository

Issue 模板：yaml 表单 vs 纯 markdown

【权威】表单语法（https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms ）：

- 文件放 `.github/ISSUE_TEMPLATE/*.yml`；顶层必填 `name`、`description`、`body`，可选 `labels`（标签不存在则不会自动创建）、`assignees`、`title`。
- body 字段类型：`markdown`（静态说明）、`textarea`、`input`、`dropdown`、`checkboxes`；每项可用 `validations.required: true` 强制填写。表单能把"复现步骤 / 环境（OS、应用版本）/ 日志"变成结构化必填项——桌面应用报 bug 恰恰最需要这些。
- `config.yml`（同目录）：`blank_issues_enabled: false` 可隐藏空白 issue 入口（有写权限的维护者仍可见）；`contact_links` 把"使用问题"导流到 Discussions 等外部渠道。来源：https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository

单人项目哪些值得要、哪些是噪音（【惯例】）：

- **值得**：bug-report.yml（表单强制环境信息）、config.yml、dependabot.yml、workflows/ci.yml、release.yml（自动 notes 分类）。
- **看情况**：PR 模板（对"人 + agent"协作可当 agent 的自查清单用，轻量几行即可；纯单人直推 main 时无意义）、feature 表单（有外部用户提需求后再加）、FUNDING.yml（想接受赞助再加，零维护成本）。
- **噪音**：CoC（无社区前）、`lock.yml`（Joplin 那种自动锁 issue 的机器人配置）、多套分类模板、GOVERNANCE。

Dependabot（【权威】https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file ）：

- 文件位置 `.github/dependabot.yml`，顶层 `version: 2`；每个 `updates[]` 条目必填 `package-ecosystem`（JS 用 `npm`，Actions 用 `github-actions`，**github-actions 的 directory 固定为 `/`**）、`directory`、`schedule.interval`（`daily`/`weekly`/`monthly`）。
- 默认最多 5 个打开的版本更新 PR（`open-pull-requests-limit`）；`groups` 可把 minor+patch 合并成一个 PR——单人项目强烈建议分组，否则 PR 噪音大。

### 1.5 参考项目的实际文件布局

官方脚手架模板（一手实查）：

- **electron-vite 官方脚手架**（`npm create @quick-start/electron@latest`，来源 https://electron-vite.org/guide/ ；npm 包 `@quick-start/create-electron@1.0.30` 解包实读）生成：
  - 根：`_gitignore`（内容：`node_modules`、`dist`、`out`、`.DS_Store`、`.eslintcache`、`*.log*`）、`.editorconfig`、`.prettierrc.yaml`、`.prettierignore`、`.vscode/{settings,extensions,launch}.json`、`package.json`、`electron.vite.config.ts`、`electron-builder.yml`、`eslint.config.mjs`、`tsconfig.json`+`tsconfig.node.json`+`tsconfig.web.json`、`src/{main,preload,renderer}/`、`build/`（icon.png/icns/ico + entitlements.mac.plist）、`resources/icon.png`。
  - 模板**不含** LICENSE、README（非空）、.github、CHANGELOG——这些要自己补。
  - electron-builder.yml 要点：`appId`/`productName`、`directories.buildResources: build`、files 里把 `dev-app-update.yml`、`.env*` 等开发文件排除出安装包、mac dmg `artifactName: ${name}-${version}.${ext}`、nsis setup 命名、`publish` 先填 generic 占位（换 GitHub Releases 时改 provider）。
  - scripts 惯例：`dev`/`build`/`typecheck:node`+`typecheck:web`/`lint`/`format`/`postinstall: electron-builder install-app-deps`/`build:mac|win|linux`。
- **Tauri 官方脚手架**（create-tauri-app，仓库 https://github.com/tauri-apps/create-tauri-app dev 分支实查）vanilla-ts 模板生成：根 `_gitignore`（logs、`*.log`、npm/yarn/pnpm/lerna-debug 日志、`node_modules`、`dist`、`dist-ssr`、`*.local`、`.vscode/*` 保留 extensions.json、`.idea`、`.DS_Store`、`*.suo/*.ntvs*/*.njsproj/*.sln/*.sw?`）、README.md（极简）、`src/`、`tsconfig.json`、`vite.config.ts`、`.vscode/extensions.json`，加 `src-tauri/`（`tauri.conf.json`、`Cargo.toml`、`build.rs`、`src/{main.rs,lib.rs}`、`capabilities/default.json`、`icons/` 全套、自己的 `_gitignore`：`/target/` 与 `/gen/schemas`）。注意：模板**不忽略 Cargo.lock**（应用应提交，见第 4 节）。README 提示 IDE 装 Tauri 插件 + rust-analyzer。

高 star 桌面应用仓库（GitHub API 实查，2026-08-21）：

| 仓库 | 技术栈 | stars | 顶层社区文件 |
|---|---|---|---|
| tw93/Pake | Tauri | 60.9k | README.md+README_CN.md、LICENSE(GPL-3.0)、CONTRIBUTING.md、CODE_OF_CONDUCT.md、TRADEMARK.md、AGENTS.md+CLAUDE.md；`.github/{FUNDING.yml, ISSUE_TEMPLATE/{bug-report.yml,feature.yml,config.yml}, workflows/*}`；pnpm + rust-toolchain.toml |
| laurent22/joplin | Electron | 56.0k | README.md、LICENSE(自定义)、CONTRIBUTING、SECURITY.md、CLAUDE.md；`.github/{FUNDING.yml, ISSUE_TEMPLATE/, ISSUE_TEMPLATE.md, PULL_REQUEST_TEMPLATE, lock.yml, workflows/}`；默认分支 `dev` |
| siyuan-note/siyuan | Electron | 45.9k | README 多语言、LICENSE(AGPL-3.0)、CHANGELOG.md、AGENTS.md、THIRD_PARTY_NOTICES.md、`.github/` |
| spacedriveapp/spacedrive | Tauri | 38.8k | README.md、CONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.md、AGENTS.md、`.github/` |

推断（【惯例】）：高 star 仓库的公约数是 README + LICENSE + `.github/workflows` + （多数）CONTRIBUTING + （多数）AGENTS.md/CLAUDE.md；CoC 与 SECURITY 约一半。单人新仓库按"必备 + 推荐"两档起步即可（见文末清单）。

---

## 2. 版本与发布

### 2.1 semver + git tag

【权威】https://semver.org/ ：`MAJOR.MINOR.PATCH`；"Major version zero (0.y.z) is for initial development. Anything MAY change at any time"，1.0.0 才"defines the public API"；预发布用连字符（`1.0.0-alpha.1`），构建元数据用加号且**不影响**版本优先级。桌面应用在 1.0 前用 `0.x.y` 迭代完全合规。作者 token-dashboard 已有 `v0.1.0`、`v0.2.0` tag，即此模式。

### 2.2 changesets vs release-please vs 手动 CHANGELOG

- **changesets**（【权威】README 自述）："A tool to manage versioning and changelogs **with a focus on monorepos**"——为多包发布 npm 设计；也补了一句 "Conceptually, the workflow is also beneficial for single package repos"。工作流是：改动附带 `.changeset/*.md` 意图文件 → `changeset version` 消费它们改版本和 CHANGELOG → `changeset publish` 发 npm。来源：https://github.com/changesets/changesets （README，v3 开发分支）。
- **release-please**（【权威】README 自述）：解析 **Conventional Commit**（`fix:`=patch、`feat:`=minor、`feat!:`=major）维护 **Release PR**，合并后自动改 CHANGELOG + package.json、打 tag、建 GitHub Release；明确说 "It does not handle publication to package managers or handle complex branch management"，并**强烈推荐 squash-merge** 保持线性历史（利于 changelog 与 bisect）。来源：https://github.com/googleapis/release-please 。
- **手动 CHANGELOG**：按 Keep a Changelog（【权威】https://keepachangelog.com/en/1.1.0/ ）——人类可读、`CHANGELOG.md` 命名、保留 `Unreleased` 节、类型 Added/Changed/Deprecated/Removed/Fixed/Security；明确反对拿 git log diff 当 changelog（"they're full of noise"）。
- **第四条路（作者已在用）**：GitHub **自动生成 Release Notes**（【权威】https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes ）：生成的 notes 含"merged PR 列表 + 贡献者 + full changelog 链接"，可用 `.github/release.yml` 按 label 分类（`changelog.exclude.labels/authors`、`categories[*].title/labels`，`'*'` 兜底）。`softprops/action-gh-release` 的 `generate_release_notes: true` 即调用它。作者 deepseek-vision 的 release.yml 就是"tag → 校验 → 自动 notes"的零维护组合。

单人项目选型（【惯例】推断）：首选 **semver tag + 自动 Release Notes**（作者已有模板）；若 agent 提交能稳定写 Conventional Commits，release-please 是与 AI 协作最契合的升级路径（机器写规范 commit → 机器生成 changelog）；changesets 仅在变成 pnpm monorepo 发多个 npm 包后才值得。

### 2.3 桌面应用 GitHub Releases 产物惯例

真实样本（GitHub API 实查）：Joplin v3.6.16 的 assets = `Joplin-3.6.16-arm64.DMG`、`-arm64.pkg`、`-arm64.zip` + `.blockmap`、`-mac.zip` + blockmap、`x64 .dmg/.pkg/.zip`、`.AppImage` + `.sha512`、`.deb`、`-Setup-3.6.16.exe` + blockmap、`JoplinPortable.exe`，以及更新元数据 `latest.yml`、`latest-mac.yml`、`latest-mac-arm64.yml`、`latest-linux.yml`。Pake（Tauri）则是每个打包站点一组 `X.dmg / X_x64.msi / X_x86_64.AppImage / X_x86_64.deb`。

Electron（【权威】electron-builder 官方文档，源文件 https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/auto-update.md ）：

- 构建时生成并上传 `latest.yml`（或 `latest-mac.yml` / `latest-linux.yml`）元数据，`electron-updater` 依此发现新版本。
- 可自动更新的 target：macOS DMG、Windows NSIS、Linux AppImage/DEB/Pacman/RPM（均为默认 target）；macOS 还需要 `zip` target 供 Squirrel.Mac，否则 `latest-mac.yml` 无法生成；**macOS 必须签名，否则自动更新不可用**。
- 支持的发布通道：GitHub Releases、S3、DigitalOcean Spaces、Cloudflare R2、Keygen、generic HTTP；支持 differential 更新（blockmap）与分阶段放量（手改 `latest.yml` 的 stagingPercentage）。

Tauri（【权威】https://v2.tauri.app/plugin/updater/ ）：

- `tauri.conf.json` 里 `"createUpdaterArtifacts": true` 后构建产出：AppImage + `.AppImage.sig`、`myapp.app.tar.gz`（updater bundle）+ `.sig`、msi/nsis 安装包 + `.sig`。
- 静态更新清单 `latest.json`：`version` + `platforms[OS-ARCH].url/.signature`；endpoints 支持 `{{current_version}}/{{target}}/{{arch}}` 变量，生产强制 TLS。
- 签名强制（"This cannot be disabled"）：`tauri signer generate` 生成密钥对，私钥经 `TAURI_SIGNING_PRIVATE_KEY` 环境变量进 CI（".env files do not work!"），私钥丢失则无法再向已装用户推更新。
- 官方发布 action：`tauri-apps/tauri-action`（构建多平台并上传/创建 GitHub Release；示例见 https://github.com/tauri-apps/tauri-action ）。

单人最小可行组合（【惯例】）：`push tag v*` → 一个 release workflow：跑测试 → electron-builder（`publish: github`）/ tauri-action 出包 → 上传 Release + 自动 notes。macOS 未签名/未公证（notarize）时应用可分发（Gatekeeper 需右键打开），但 Electron 自动更新与 Tauri updater 强签名是硬门槛——首期可以不做自动更新，Release 只放 dmg/msi。

---

## 3. 分支模型

三种模型的一手定义：

- **GitHub Flow**（【权威】https://docs.github.com/en/get-started/using-github/github-flow ）："a lightweight, branch-based workflow"：建分支（"A short, descriptive branch name"）→ 提交 → 开 PR → 讨论/评审 → 合并 → **删除分支**。无 develop、无 release 分支。
- **Trunk-Based Development**（【权威】https://trunkbaseddevelopment.com/ ）：所有人围绕单主干（main）协作，"resist any pressure to create other long-lived development branches"；特性分支只允许"short-lived and the product of a single dev-workstation"，存活不超过一两天，仅用于 code review 与 CI；大改动用 feature flag / branch-by-abstraction 而非长分支。发布两种模式：just-in-time 切 release 分支（发布后不久即删）或**直接从主干发布 + fix forward**，后者"also suits high-throughput teams"。"Very small teams may commit direct to the trunk"——单人可以直接推主干。
- **git-flow**（【权威】Driessen 原文 https://nvie.com/posts/a-successful-git-branching-model/ ）：master（生产就绪，合并即打 tag）+ develop（集成）+ feature/release/hotfix 五类分支。Driessen 2020 年反思明确："If your team is doing continuous delivery of software, I would suggest to adopt a much simpler workflow (like GitHub flow)"；git-flow 只适合"explicitly versioned"且需并行维护多版本的软件。社区批评可参考 Adam Ruka《GitFlow considered harmful》（2015，https://endoflineblog.com/gitflow-considered-harmful ）：master/develop 双轨冗余（"there is nothing gained by having two branches instead of one"）、`--no-ff` 让历史变面条；其替代方案 OneFlow = 单 main + 临时 release 分支。

对"单人 + AI agent 协作（agent 在短命分支上工作、PR 合并）"的适配结论（【惯例】推断，与权威建议一致）：

1. **GitHub Flow / 单主干 trunk-based 是唯一合理解**——这正是它为"分支短命、频繁合并"设计的场景；agent 分支即 trunkbaseddevelopment.com 说的"short-lived, product of a single dev-workstation"分支，PR 是给 CI 和人审 agent 产出的闸口。
2. main 为唯一长命分支（作者 token-dashboard 的 `feature/* prototype/* research/*` + main 就是这个形态）；agent 分支建议固定前缀（如 `agent/<task-id>`、`feat/`、`fix/`）便于识别与批量清理。
3. **Squash merge + 线性历史**：release-please 官方也强烈推荐 squash（利于 changelog、bisect、main 上任意 commit 都过 CI）；agent 的中间 commit 噪音被压成一条干净记录。
4. **发布用 tag，不用 release 长分支**：tag `v*` 触发 release workflow（作者 deepseek-vision 现行做法；tauri-action 官方示例用 release 分支，但单人应用从 main 打 tag + fix-forward 更省）；确需并行维护旧版本时再考虑 Driessen 场景的 release/hotfix 分支。
5. 每次合并后删分支（GitHub Flow 第 6 步明说，PR 记录不丢）。
6. 反面参考：agent-connector 默认分支是 `dev`——desktop 应用仓库默认分支建议就叫 `main`（Joplin 用 `dev` 属于历史包袱，不建议效仿）。

---

## 4. .gitignore

### 4.1 Node + Electron 一套

综合来源：【权威】github/gitignore 官方 `Node.gitignore`（https://github.com/github/gitignore/blob/main/Node.gitignore ）、`Global/macOS.gitignore`、`Global/Windows.gitignore`；【权威】electron-vite 官方模板 `_gitignore`（`node_modules / dist / out / .DS_Store / .eslintcache / *.log*`）；作者 agent-connector 现行 `.gitignore`（`node_modules/ out/ release/ .DS_Store *.log`）与 create-electron electron-builder.yml 的打包排除清单（证明 `dev-app-update.yml`、`.env*` 是本地开发产物）。

```gitignore
# 依赖
node_modules/

# 构建产物（electron-vite 输出 out/，electron-builder 输出 release/ 或 dist/）
out/
dist/
release/
*.tsbuildinfo

# 日志与调试
*.log
logs/
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# 缓存
.eslintcache
.stylelintcache
.vite/
*.tgz

# 环境变量与本地密钥（证书、签名、API key）
.env
.env.*
!.env.example
dev-app-update.yml        # electron-updater 本地调试配置
*.p12                     # macOS 签名证书
*.p8 / *.mobileprovision  # Apple provisioning（无 iOS 时可省）
*.cer / *.pfx             # Windows 签名

# 编辑器/系统
.DS_Store
Thumbs.db
Desktop.ini
.vscode/*                 # 保留共享配置（可选）
!.vscode/extensions.json
.idea/
```

（以上是"该有的全集"，落地时可精简；作者 agent-connector 的 5 行版本已覆盖最致命的三类：node_modules、out、release。）

### 4.2 Node + Tauri 一套

综合来源：【权威】create-tauri-app 官方模板根 `_gitignore`（https://github.com/tauri-apps/create-tauri-app/blob/dev/templates/template-vanilla-ts/_gitignore ）与 `src-tauri/_gitignore`（`/target/`、`/gen/schemas`）；【权威】github/gitignore `Rust.gitignore`（`target`、`**/*.rs.bk`、`*.pdb`）；Tauri updater 文档（私钥 `~/.tauri/*.key`，环境变量注入而非入库）；Pake 实际提交 `src-tauri/Cargo.lock`（GitHub API 实查）。

```gitignore
# 前端（Node）侧
node_modules/
dist/
dist-ssr/
*.local
*.tsbuildinfo
.eslintcache
.vite/
*.log
npm-debug.log*
pnpm-debug.log*

# Rust / Tauri 侧（放根 .gitignore 或 src-tauri/.gitignore 均可）
src-tauri/target/         # Cargo 构建产物（官方 Rust.gitignore 的 target）
src-tauri/gen/schemas     # Tauri 生成的 capabilities schema
*.rs.bk
*.pdb                     # MSVC 调试符号

# 环境变量与签名密钥
.env
.env.*
!.env.example
*.key                     # tauri signer 私钥（TAURI_SIGNING_PRIVATE_KEY 走 CI secret）

# 系统
.DS_Store
Thumbs.db
Desktop.ini
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.sw?
```

**注意 Cargo.lock 要提交**：【权威】Cargo Book FAQ 说明 lockfile 的意义是"deterministic builds"（git bisect、CI 稳定性、贡献者一致性）；create-tauri-app 模板未忽略它，Pake 也实际提交——桌面应用按"应用"而非"库"处理。

### 4.3 桌面仓库常见误提交物清单（【惯例】，部分有本地实证）

| 类别 | 具体文件 | 证据/来源 |
|---|---|---|
| 打包产物 | `release/`（含 `builder-debug.yml`、`builder-effective-config.yaml`、`mac-arm64/*.app`） | 作者 agent-connector `release/` 目录实存（已被其 .gitignore 忽略，属正确处理）；electron-builder 默认输出 |
| 前端/主进程产物 | `out/`、`dist/`、`src-tauri/target/` | create-electron 与 create-tauri-app 官方模板均忽略 |
| 系统杂物 | `.DS_Store`（作者 token-dashboard 工作区顶层实存一个，已被忽略）、`Thumbs.db` | github/gitignore macOS/Windows 模板 |
| 签名/公证 | `*.p12`、`*.p8`、`*.mobileprovision`、`*.cer/*.pfx`、Tauri `*.key` | electron-builder code-signing、Tauri updater 文档（私钥"cannot be a file path"入库更不行） |
| 本地配置/密钥 | `.env*`（`!.env.example` 例外）、`dev-app-update.yml` | Node.gitignore 官方模板；create-electron 打包排除清单 |
| 本地数据/日志 | `*.sqlite`、`*.db`、`logs/`、`*.log`、`~$*` | Node.gitignore；桌面应用常带本地存储 |
| 测试工具缓存 | `.playwright-cli/`、`coverage/`、`.nyc_output` | 作者 token-dashboard .gitignore；Node.gitignore |
| 包管理器缓存 | `.pnpm-store/`、`.npm/` | Node.gitignore 官方模板 |

---

## 5. 工具链配合（pnpm workspace + CI）

### 5.1 pnpm workspace

- 作者已在 token-dashboard 使用 `pnpm-workspace.yaml`（当前主要放 `minimumReleaseAgeExclude` 供应链策略清单）——即便 dsh-gui 首期是单包，保留 pnpm + workspace 文件为将来拆 `desktop`/`ui`/`shared` 留好口子（【惯例】）。deepseek-vision 的 `"packageManager": "pnpm@11.21.0"` 字段是官方推荐的版本锁定方式：pnpm/action-setup 与 pnpm/setup 都能从该字段读取版本，"the workflow never needs updating when you change it"（【权威】pnpm 文档）。
- changesets 与 pnpm monorepo 是标配组合（changesets 自述 focus on monorepos）；不发 npm 的单应用仓库不需要。

### 5.2 CI 最小骨架（GitHub Actions）

作者现成范本（可直接沿用）：`/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/.github/workflows/ci.yml` —— `on: push(main) + pull_request`，单 job：checkout → pnpm/action-setup@v4 → actions/setup-node@v4（`cache: pnpm`）→ `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm build` → `pnpm test`。

【权威】2026 年的更新（pnpm 官方文档 https://pnpm.io/continuous-integration + https://github.com/pnpm/action-setup README）：

- `pnpm/action-setup` 有继任者 **`pnpm/setup`**："For pnpm v11 and newer, use pnpm/setup instead. It downloads pnpm's self-contained release binary (no Node.js or npm required) and can install a JavaScript runtime in the same step, replacing actions/setup-node."
- 官方新写法（一步装 pnpm+Node 并自动 `pnpm install` + 缓存）：

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: pnpm/setup@v1        # 要求 pnpm v11+；packageManager 字段已声明时可省 version
    with:
      version: 11
      runtime: node@22
      cache: true
  - run: pnpm typecheck
  - run: pnpm build
  - run: pnpm test
```

- pnpm 在 CI 里**自动切换 frozen-lockfile**（"When pnpm detects that it is running in CI, it switches to frozen-lockfile mode automatically"），v11 起锁文件大版本不匹配会直接报错——CI 的 pnpm 版本要跟生成 lockfile 的一致。store 缓存可选（官方明说"not guaranteed to make installation faster"）。

桌面应用 CI 的增量项（【惯例】）：

- lint/typecheck/test 在 ubuntu 上跑即可（便宜）；**打包 job 必须按目标系统分 runner**（macOS 出 dmg/notarize，windows 出 nsis/msi，linux 出 AppImage/deb）——Joplin/Pake 的产物矩阵即证；Electron 用 electron-builder 的 `--mac/--win/--linux` + `publish` 配置，Tauri 用 `tauri-apps/tauri-action` 官方矩阵示例（macos-latest ×2 target、ubuntu、windows）。
- 加 `concurrency: group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true` 省额度（agent 高频推分支时明显）。
- 签名/notarize 凭据全部走 GitHub Actions secrets（Apple `keychain` profile / `TAURI_SIGNING_PRIVATE_KEY`），绝不入库（与第 4 节呼应）。

---

## 推荐的最小文件集（dsh-gui）

### 必备（第一次 commit 就带上）

| 文件 | 说明 |
|---|---|
| `LICENSE` | MIT，`Copyright (c) 2026 apodemakeles`（沿用作者惯例；从 token-dashboard 复制即可） |
| `README.md` + `README.zh.md` | 双语互链（作者惯例）；英文版小节：一句话定位+badges → Screenshot → Install（安装包/源码）→ Quick start → Development → Contributing → License |
| `.gitignore` | 第 4 节 Electron 版或 Tauri 版（按最终选型二选一） |
| `package.json` | 桌面应用设 `"private": true`；`packageManager: "pnpm@11.x"`；scripts 至少 `dev/lint/typecheck/test/build` |
| `.github/workflows/ci.yml` | 抄 deepseek-vision 的 ci.yml；若锁 pnpm 11+ 则换 `pnpm/setup@v1` 新写法 |
| `.editorconfig` | create-electron 官方模板自带，零成本 |
| `AGENTS.md`（或 CLAUDE.md） | 2026 桌面仓库新标配（Pake/Spacedrive/SiYuan/Joplin 均有）；给协作 agent 的仓库说明书：命令、分支约定、禁区 |

### 推荐（首个月内补齐）

| 文件 | 说明 |
|---|---|
| `.github/ISSUE_TEMPLATE/bug-report.yml` + `config.yml` | yaml 表单强制"系统版本 / 应用版本 / 复现步骤 / 日志"；`blank_issues_enabled: false` |
| `.github/dependabot.yml` | `npm` + `github-actions` 两个 ecosystem，weekly，开 `groups`（minor+patch 合并） |
| `.github/workflows/release.yml` | 抄 deepseek-vision：tag `v*` → 校验 → 打包 → `softprops/action-gh-release@v2` + `generate_release_notes: true`（Electron）或 `tauri-action`（Tauri） |
| `.github/release.yml` | 自动 notes 的 label 分类（如排除 `chore`） |
| `SECURITY.md` | 5 行版：支持版本 + 私下报告渠道（桌面二进制分发的信任基础） |
| `CONTRIBUTING.md` | 简短：环境要求、dev/test/typecheck、分支与 PR 约定（人与 agent 通用） |
| `.vscode/extensions.json` | 模板自带，推荐跟随 |
| `CHANGELOG.md`（可选其一） | 要就按 Keep a Changelog 格式；或完全依赖 GitHub Releases 自动 notes（作者现行做法） |

### 可选（有外部贡献/有需求再加）

`CODE_OF_CONDUCT.md`（Contributor Covenant）、`.github/ISSUE_TEMPLATE/feature.yml`、`.github/PULL_REQUEST_TEMPLATE.md`（当 agent 自查清单用）、`.github/FUNDING.yml`、`SUPPORT.md`、`.github/ISSUE_TEMPLATE/config.yml` 的 contact_links（开 Discussions 后）、`.github/renovate.json`（替代/超越 dependabot，Pake/Joplin 用 renovate）。

### 明确不建议（单人期）

git-flow 的 develop/release/hotfix 长命分支体系；changesets（无 npm 多包发布需求）；CODEOWNERS（单人无意义）；大而全的 PR 模板与多套 issue 分类；未签名就启用自动更新（Electron macOS 签名是 electron-updater 硬前提，Tauri updater 强制签名）。

---

## 来源清单

**本地实读（作者仓库）**

- `/Users/caozheng/github/apodemakeles/dsh-token-dashboard/`：LICENSE、README.md、README.zh.md、package.json、pnpm-workspace.yaml、.gitignore、git 分支/tag
- `/Users/caozheng/github/apodemakeles/dsh-deepseek-vision/`：LICENSE、README.md、package.json、.gitignore、`.github/workflows/ci.yml`、`.github/workflows/release.yml`
- `/Users/caozheng/github/apodemakeles/agent-connector/`：package.json、README.md、.gitignore、release/、build/、electron 相关配置
- `/Users/caozheng/github/apodemakeles/dsh-gui/.scratch/dsh-gui-scaffold/`（现有规划文件，本文件同目录）

**GitHub 官方文档**

- 社区健康文件总览：https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions
- 默认社区健康文件与放置顺序：https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
- About READMEs：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
- Issue Forms 语法：https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- Issue 模板 chooser / config.yml：https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- Security policy（ES 3.19 镜像，com 对应文 404）：https://docs.github.com/en/enterprise-server@3.19/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy
- FUNDING.yml：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository
- 自动生成 Release Notes：https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
- GitHub Flow：https://docs.github.com/en/get-started/using-github/github-flow
- Dependabot 配置：https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file

**版本与发布**

- SemVer：https://semver.org/
- Keep a Changelog 1.1.0：https://keepachangelog.com/en/1.1.0/
- changesets README（monorepo focus 原文）：https://github.com/changesets/changesets
- release-please README（Conventional Commits / squash 建议 / Release PR 机制）：https://github.com/googleapis/release-please
- electron-builder Auto Update（latest*.yml、签名前提、providers、staged rollout）：https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/auto-update.md
- Tauri v2 Updater（.sig/latest.json/pubkey/TAURI_SIGNING_PRIVATE_KEY）：https://v2.tauri.app/plugin/updater/
- tauri-action（官方发布 action 与多平台矩阵示例）：https://github.com/tauri-apps/tauri-action

**分支模型**

- Trunk-Based Development：https://trunkbaseddevelopment.com/
- git-flow 原文（含 2020 反思）：https://nvie.com/posts/a-successful-git-branching-model/
- GitFlow considered harmful（Adam Ruka, 2015，社区批评视角）：https://endoflineblog.com/gitflow-considered-harmful

**模板与同类仓库（GitHub API / npm 包实查，2026-08-21）**

- electron-vite 脚手架指南：https://electron-vite.org/guide/ ；npm 包 `@quick-start/create-electron@1.0.30`（模板文件与 electron-builder.yml 实读）
- create-tauri-app 模板（vanilla-ts 与 `_base_/src-tauri/_gitignore`）：https://github.com/tauri-apps/create-tauri-app （dev 分支）
- github/gitignore 官方模板：Node / Rust / Global/macOS / Global/Windows（https://github.com/github/gitignore）
- Cargo Book FAQ（Cargo.lock 与确定性构建）：https://doc.rust-lang.org/cargo/faq.html
- 样本仓库布局：tw93/Pake（60.9k，Tauri）、laurent22/joplin（56.0k，Electron；Release assets 含 latest*.yml 实证）、siyuan-note/siyuan（45.9k，Electron）、spacedriveapp/spacedrive（38.8k，Tauri）

**pnpm / CI**

- pnpm CI 指南（pnpm/setup、CI 自动 frozen-lockfile、缓存建议）：https://pnpm.io/continuous-integration
- pnpm/action-setup README（pnpm/setup 继任说明与迁移表）：https://github.com/pnpm/action-setup

**未查到 / 存疑**

- GitHub Docs 关于 SECURITY.md 的 dotcom 版文章 URL 在本次调研中 404（用企业 Server 3.19 同文代替），若需精确引用 dotcom 版需再核对。
- 「README 必须包含 badges」无任何权威来源——badges 属社区惯例（样本仓库普遍使用），非官方要求。
