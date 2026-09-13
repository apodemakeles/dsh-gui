#!/bin/sh
# PROTOTYPE · turn-notify 票 05 · 用完即弃
# 真机横幅脚本：弹真实的 macOS 系统通知，用来对比两种通知排版。
# 注意：横幅右下角 App 名此刻显示的是 osascript 的宿主（如「脚本编辑器」），
# 真实实现里会是 dsh-gui 及其图标——看「标题/副标题/正文的排布」即可。
#
# 用法:
#   ./notify.sh a        # 方案 A · 处理完成（标题=会话名，正文=动词）
#   ./notify.sh a-fail   # 方案 A · 处理失败
#   ./notify.sh b        # 方案 B · 处理完成（标题=动词，副标题=会话名）
#   ./notify.sh b-fail   # 方案 B · 处理失败
#   ./notify.sh all      # 依次弹全部四条（每条间隔 9 秒）

SESSION="调试 WebSocket 重连"

case "$1" in
  a)      osascript -e "display notification \"处理完成\" with title \"$SESSION\"" ;;
  a-fail) osascript -e "display notification \"处理失败\" with title \"$SESSION\"" ;;
  b)      osascript -e "display notification \"\" with title \"处理完成\" subtitle \"$SESSION\"" ;;
  b-fail) osascript -e "display notification \"\" with title \"处理失败\" subtitle \"$SESSION\"" ;;
  all)
    "$0" a
    sleep 9
    "$0" b
    sleep 9
    "$0" a-fail
    sleep 9
    "$0" b-fail
    ;;
  *) echo "用法: ./notify.sh [a|a-fail|b|b-fail|all]" ;;
esac
