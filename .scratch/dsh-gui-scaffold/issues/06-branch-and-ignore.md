# 06 · 分支策略与忽略清单

Type: grilling
Status: resolved
Blocked by: 02, 04, 05

## Question

1. **分支模型**：main 单干 + 短命 feature 分支（trunk-based）？要不要 release 分支/仅 tag 发布？依据 02 的调研给单人+AI 协作（agent 会在分支上工作）的实践建议定案。
2. **保护与工作流**：PR-vs-direct、commit message 规范（是否约定式提交）、tag/版本节奏。
3. **.gitignore 定稿**：依据 04 技术栈与 05 布局列排除清单（node_modules、构建产物、release 产物、签名/证书、本地 DB、`.scratch/` 是否入库也在此定）。

## Comments

- 2026-08-21 · 研究输入（来自 [02](02-oss-repo-standards.md)）：权威共识为 GitHub Flow 单主干——main + 短命分支 + squash merge + tag 发布，不用 release 长分支；agent-connector 默认分支叫 dev 是反面教材。Electron/Tauri 两套 .gitignore 成型清单已备（Tauri 时 Cargo.lock 需提交）。token-dashboard 的 `.scratch/` 入库实况记录在 01 报告中。

## Answer

（2026-08-28 grilling 落定。）

1. **分支纪律 = GitHub Flow 宽松版**：main 唯一长命分支；agent 一律短命分支（`agent/`、`feat/`、`fix/` 前缀）→ PR → squash merge → 删分支；人琐碎修改可直推 main；发布 = main 打 tag `v*` 触发 release workflow，版本自 0.1.0 起。
2. **提交规范 = 轻量约定式**：`feat:` / `fix:` / `chore:` / `docs:` 前缀，squash 后 main 一条变更一条记录；将来接 release-please 零改造。commit-msg 钩子列为可选项，脚手架不上。
3. **构建产物 = prepare 路线**：`lib/` 进 .gitignore，仓库只存源码，用户安装后 `prepare` 自构建（vision 路线，官方推荐写法）；dsh-gui 依赖 electron，用户本就要配一次 allowBuilds，prepare 只是多一行 key。
4. **.gitignore 定稿**：`node_modules/`；`out/` `dist/` `release/` `lib/` `*.tsbuildinfo`；`*.log`；`.vite/`；`*.tgz`；`.env*`（保留 `.env.example`）；`dev-app-update.yml`；签名证书（`*.p12` 等）；`.DS_Store`；`.idea/`。
5. **`.scratch/` 入库**：沿用本屋惯例（token-dashboard 36 文件、vision 均入库），规划历史公开透明。
6. **规则落地分层**（用户追问确认）：纪律文本写 AGENTS.md（07）+ CONTRIBUTING；`.github/workflows/` 只放执行器（ci.yml 闸口、release.yml 发布）；branch protection 属 GitHub 仓库设置（非文件），落库后用户自行开启「禁 force push、CI 必过」。
