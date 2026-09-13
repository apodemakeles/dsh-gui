# 05 · prototype：通知呈现与设置卡形态选型

Type: prototype
Status: resolved
Blocked by: 02, 03

## Question

作者要求出多套原型供选择（HITL，agent 不得替选）。在 02/03 确认的能力边界内做廉价可反应的原型：

1. **通知呈现**：只带会话名约束下的排版选型（如：会话名直出 / 会话名+「处理完成」动词 / 失败态文案形态）；至少两套供选。
2. **设置卡形态**：卡片放设置区哪个位置、控件样式（纯开关 / 开关+说明文案 / 预留将来子开关的分组样式）；至少两套供选。
3. **点击行为**：聚焦窗口 vs 聚焦+跳转会话（依 02 票第 5 条的路由能力结论），出对照说明。

产出：原型资产（HTML 线稿/stub 或截图）放 `.scratch/turn-notify/prototype/`，链接进本票；作者选择结果记录在 Answer。

## Answer

原型会话（2026-09-13）产出三份资产（`.scratch/turn-notify/prototype/`：notify.sh 真机横幅脚本、notification.html 排版与点击对照、settings-card.html 设置卡三变体），作者逐项选定：

1. **通知排版：方案 A · 会话名为主**——`title = 会话名`，`body =「处理完成」/「处理失败」`。堆叠里先读到「哪个会话」。已在真机用 osascript 复核完成/失败两条横幅。
2. **设置卡形态：交由 dsh 官方机制**（作者原话「按 dsh 的机制规范来」）——用 02 票查实的 `settings.plugin.item`（keyed，key = 命名空间）注册 title/description/开关，**视觉形态由官方设置页渲染，不自定义卡片**。原型页的 A/B/C 仅作参考，不作选型。
3. **点击行为：聚焦 + 跳转**——点通知把壳拉到前台并 `ctx.sessions.open(sessionId)` 直达该会话（vision 插件有先例）。

（附注：notify.sh 首版 `all` 分支相对路径自调用 bug 已修；真机横幅 App 名/图标与 dsh-gui 的差异见脚本头注释。）
