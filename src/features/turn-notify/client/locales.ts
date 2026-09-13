// turn-notify feature — browser half dictionaries (zh primary, en secondary).

export const LOCALE_NS = 'turn-notify'

export const zh = {
  'card.title': '轮次完成通知',
  'card.description': '对话处理完成后，若 dsh-gui 不在前台，弹 macOS 系统通知。',
  'card.loading': '加载中…',
  'card.unavailable': '设置暂不可用',
} as const

export const en = {
  'card.title': 'Turn completion notifications',
  'card.description':
    'Show a macOS notification when a conversation turn finishes while dsh-gui is not in the foreground.',
  'card.loading': 'Loading…',
  'card.unavailable': 'Settings unavailable',
} as const

export type CardKeys = keyof typeof zh
