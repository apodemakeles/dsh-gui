# 01 · 侦察：web client 产物定位与装配设计

Type: research
Status: open

## Question

读 deepseek-harness 源码（apps/web、packages/host/webserver、packages/client/modules），回答 spec 的三个开放问题：

1. `dsh web` 场景下发给浏览器的 web client 构建产物在磁盘上的位置；Electron 壳如何定位/获取（宿主服务？dsh 安装目录约定？）。
2. `window.__DSH_BOOT__` 引导图与 `/plugins/<id>/client.js` 在 file:// 场景的等价物怎么生成。
3. `AbstractApiClient` 的 doFetch 在官方 client 代码中的注入/替换点（externals 白名单是否允许外部子类）。

产出：结论写回本 issue 的 `## Answer`（带源码出处路径）；若与官方叙事有出入（如必须开端口/必须 HTTP），如实记录并给出取舍建议 + 是否值得 ADR。**本票只侦察不写实现代码。**
