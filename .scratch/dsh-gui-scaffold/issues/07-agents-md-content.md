# 07 · AGENTS.md 规范内容定稿

Type: grilling
Status: resolved
Blocked by: 05, 06

## Question

仓库根 AGENTS.md 写哪些「预设与规范」让未来的 agent 会话（zcode/codex 等）开箱即用？候选清单（依据 05/06 的结论裁剪）：

- 项目一句话定位与目录导航（agent 进门先看什么）
- 构建/测试/lint/typecheck 的标准命令（含代理 export 预设）
- 代码风格与模块边界约定、测试放置约定
- dsh 插件开发规范引用（本地范本指路）
- 提交/分支纪律（06 的结论落成规则）
- 安全边界：密钥、签名证书、`~/.dsh/settings.yaml` 等本机路径的处理规则
- dsh 版本兼容策略的呈现：官方无 engines 机制（README 明言有破坏性变更），本屋做法是 peerDeps 全量 pin + README 注明——写进 AGENTS.md 让 agent 改依赖时不乱升级
- 中英文与文档双语惯例

## Comments

- 2026-08-28 · 06 号票定型输入：AGENTS.md 是纪律文本的家——分支纪律（agent 短命分支+PR+squash、人可直推琐碎、tag `v*` 发布）、轻量约定式提交前缀（`feat:/fix:/chore:/docs:`）、`.github/` 只放执行器的分工说明，都写进来；`.scratch/` 入库的说明也宜带一句（告诉 agent 规划文件要提交）。

## Answer

（2026-08-28 grilling 落定。大纲八节 + 两项用户拍板：）

1. **语言 = 中文**；README 双语面向世界，AGENTS.md 面向作者与 agent。
2. **验证纪律 = 建议级**：写「建议跑 `typecheck` 与 `test`」，不设为完成任务的硬门槛。

**AGENTS.md 大纲（08 落地时照此撰写）**：

1. 项目是什么——一句话定位（CONTEXT.md 开篇语）；`.scratch/dsh-gui-scaffold/` 是规划地图入口，改动随库提交。
2. 目录导航——单包布局：`src/index.ts` 唯一插件入口（新功能在 `apply()` 注册，住 `src/features/<名>/`）、`src/shell/` 四目录、`docs/adr/`。
3. 领域速览——dsh 三层积木（plugin/bundle/profile）、槽位系统、IPC fetch carrier 三五行说明 + 官方文档链接 + 本仓库存档调研（`.scratch/dsh-gui-scaffold/research/`）+ 本屋范本（token-dashboard）指路。
4. 常用命令——pnpm 专用（禁 npm/yarn）；`dev`/`build`/`typecheck`/`test`/`package:mac`；外网请求前代理 export 预设。
5. 变更纪律——06 全套：agent 短命分支 + PR + squash + 删分支，人可直推琐碎；约定式前缀；`.github/` 只放执行器；验证为建议级（见上）。
6. 版本与兼容——peerDeps 全量 pin 单一 rc；升级 dsh 前人工核对破坏性变更，agent 不得自行升 dsh 相关依赖。
7. 安全边界——`.env`/证书永不入库；`~/.dsh/` 下内容（settings.yaml、会话记录）视为敏感，不得在日志/回复/提交中回显密钥或用户数据；`release/`、`lib/` 产物不入库。
8. 语言与文档——交流与内部文档中文；README 双语互链；新文档进 `docs/`。
