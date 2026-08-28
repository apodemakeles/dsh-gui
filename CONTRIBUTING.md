# 贡献指南 · dsh-gui

## 环境

- Node `>= 20`，pnpm（版本由 `packageManager` 锁定，勿用 npm/yarn）。
- `pnpm install` 会顺带执行 `prepare`（构建 `lib/` 与 `out/`），首次安装较慢属正常。

## 日常命令

```sh
pnpm dev          # 起 Electron 壳（当前为占位窗口）
pnpm typecheck    # 类型检查
pnpm test         # vitest 测试
pnpm build        # 全量构建（壳 out/ + 插件 lib/）
```

## 分支与提交

- **分支**：GitHub Flow 宽松版——main 是唯一长命分支；改动走短命分支（`feat/`、`fix/`、`agent/` 前缀）→ PR → squash merge → 删除分支；琐碎修改作者本人可直推 main。
- **提交信息**：约定式前缀 `feat:` / `fix:` / `chore:` / `docs:`。
- **发布**：在 main 上打 `v*` tag（semver），release workflow 自动出 GitHub Release。
- 提交前**建议**跑通 `pnpm typecheck` 与 `pnpm test`（不作为硬性门槛）。

完整的 agent 协作规约（目录导航、领域速览、安全边界、版本兼容策略）见 [AGENTS.md](AGENTS.md)。
