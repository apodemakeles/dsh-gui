// Shared tooltip: portal-ed to document.body with fixed positioning and
// viewport clamping, so it can never be clipped by the panel's scroll
// container (the panel is overflow:auto and transformed).
//
// Content per user decision: no input/output/cache split — instead the
// per-model distribution, top-3 by usage plus an aggregated "others" row.
// The per-model field is optional on buckets: a host that predates it must
// degrade to a graceful empty state, never throw.

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TokenDayBucket } from '../../core/types.ts'
import { fmt } from '../fmt.ts'

const MARGIN = 10
const TIP_WIDTH = 360
const TIP_HEIGHT = 170
const TOP_MODELS = 3

/** Clamp a viewport point so a TIP_WIDTH x TIP_HEIGHT box stays fully visible. */
export function clampTip(x: number, y: number): { left: number; top: number } {
  let left = x + 12
  if (left + TIP_WIDTH > window.innerWidth - MARGIN) left = x - TIP_WIDTH - 12
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - TIP_WIDTH - MARGIN))
  const top = Math.max(MARGIN, Math.min(y + 10, window.innerHeight - TIP_HEIGHT - MARGIN))
  return { left, top }
}

export interface TipProps {
  x: number
  y: number
  children: ReactNode
}

export function Tip({ x, y, children }: TipProps) {
  const { left, top } = clampTip(x, y)
  return createPortal(
    <div className="td-tip" style={{ left, top }}>
      {children}
    </div>,
    document.body,
  )
}

/** Tooltip body: date + total, per-model top-3 + others, request count. */
export function DayTipContent({ day, t }: { day: TokenDayBucket } & PropsLocale<'token-dashboard'>) {
  const models = day.byModel ?? []
  const top = models.slice(0, TOP_MODELS)
  const restTokens = models.slice(TOP_MODELS).reduce((sum, entry) => sum + entry.tokens, 0)
  const restCount = models.length - top.length
  return (
    <>
      <div className="big">{t('hoverTotal', { date: day.date, total: fmt(day.totalTokens) })}</div>
      <div className="divider" />
      {top.map((entry) => (
        <div className="sub model" key={entry.provider + '::' + entry.model}>
          <span className="name">{entry.provider} · {entry.model}</span>
          <span className="val">{fmt(entry.tokens)}</span>
        </div>
      ))}
      {restCount > 0 && (
        <div className="sub model">
          <span className="name">{t('others')}（{restCount}）</span>
          <span className="val">{fmt(restTokens)}</span>
        </div>
      )}
      {models.length === 0 && <div className="sub">{t('empty')}</div>}
      <div className="divider" />
      <div className="sub">{t('hoverRequests', { n: day.requests })}</div>
    </>
  )
}
