# 02 · 开源桌面应用仓库的社区标准调研

Type: research
Status: resolved

## Question

一个 2026 年在 GitHub 开源的桌面端（Electron/Tauri 二选一未定）Node/TS 项目，仓库应当具备哪些标准文件与惯例？具体要查清：

- 必备/推荐文件清单：README（结构、badges）、LICENSE（兄弟仓库用什么许可证）、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY.md、CHANGELOG、`.github/`（issue/PR 模板、CI、dependabot）
- 版本与发布惯例：semver、git tag、changesets vs release-please，solo maintainer 的最小可行组合
- 分支模型实践：trunk-based vs GitHub Flow vs git-flow，小团队/单人开源桌面项目的主流选择与取舍
- .gitignore 要点：Node + Electron 与 Node + Tauri 两套都要（技术栈未定），以及桌面仓库常见误提交物（release 产物、签名证书、本地数据库）
- pnpm workspace（token-dashboard 已用）与上述各项的配合；CI 最小骨架（lint/typecheck/test/build）在 GitHub Actions 上的惯例写法

## Answer

调研完成（2026-08-21，GitHub Docs / semver.org / Keep a Changelog / changesets / release-please / electron-builder / Tauri v2 / trunkbaseddevelopment.com 等一手资料 + 4 个高 star 桌面仓库与官方脚手架模板实查），完整报告：[research/oss-repo-standards.md](../research/oss-repo-standards.md)。要点：

- **作者惯例可直接沿用**：MIT License（(c) 2026 apodemakeles）、README.md + README.zh.md 双语互链、pnpm、`typecheck` 脚本；deepseek-vision 的 `ci.yml` 与 `release.yml`（tag v* → GitHub Release + 自动 Release Notes）可整套复用给 dsh-gui。反面教材：agent-connector 缺 LICENSE、默认分支叫 dev。
- **放置规则（GitHub Docs 权威）**：社区文件优先级 `.github/` > 根 > `docs/`；issue 模板必须在 `.github/ISSUE_TEMPLATE/`；LICENSE 不能由账号级默认仓库下发。
- **发布最小组合**：semver tag + 自动 Release Notes + electron-builder / tauri-action 产物。实证：Joplin Release 含 dmg/pkg/zip + `latest*.yml`（electron-updater 消费）；Tauri updater 产 `.sig` + `latest.json`、签名私钥走 CI secret。changesets 面向 monorepo 包发布，单人应用不必上。
- **分支模型共识**：GitHub Flow / 单主干（trunk-based）；推荐 main + 短命分支 + squash merge + tag 发布，不用 release 长分支。
- **两套 .gitignore 清单已成型**：Electron（out/dist/release、.env、dev-app-update.yml、签名证书）与 Tauri（src-tauri/target/、gen/schemas、`*.key`；**Cargo.lock 要提交**）。
- **2026 新信息**：pnpm v11+ 的 CI 已迁移到单步骤 `pnpm/setup`；高 star 桌面仓库普遍标配 AGENTS.md/CLAUDE.md（Pake、Joplin、SiYuan、Spacedrive 四个样本全有）。
- 报告末附给 dsh-gui 的三档最小文件集（必备/推荐/可选）与「明确不建议」清单；两处存疑点已如实标注。
