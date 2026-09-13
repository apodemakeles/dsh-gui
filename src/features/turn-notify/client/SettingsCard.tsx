// The settings card: one toggle over the `turn-notify` namespace (spec.md
// §3.4 — the official Plugins tab renders the card shell; this component only
// draws the row). Reads mirror the shared describe snapshot; writes go through
// scope.set, which serializes back to the host document.

import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ClientSettingsScope, PropsLocale } from '../../../client/client-context.ts'
import type { CardKeys } from './locales.ts'

export interface TurnNotifyConfig {
  enabled?: boolean
}

export type TurnNotifyCardProps = PropsLocale<CardKeys> & {
  scope: ClientSettingsScope<TurnNotifyConfig>
}

export function TurnNotifySettingsCard({ scope, t }: TurnNotifyCardProps) {
  const snapshot = useSyncExternalStore(scope.subscribe, scope.getSnapshot)
  const enabled = snapshot.value?.enabled ?? true
  const ready = snapshot.status === 'ready'

  return (
    <div className="tn-card">
      <div className="tn-copy">
        <div className="tn-title">{t('card.title')}</div>
        <div className="tn-desc">{t('card.description')}</div>
        {!ready && (
          <div className="tn-state">
            {snapshot.status === 'loading' ? t('card.loading') : t('card.unavailable')}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('card.title')}
        className="tn-switch"
        data-on={enabled}
        disabled={!ready}
        onClick={() => {
          void scope.set('enabled', !enabled).catch((error: unknown) => {
            console.error('turn-notify: settings write failed', error)
          })
        }}
      />
    </div>
  )
}

/**
 * Closure component factory: the bound scope rides in closure while the slot
 * runtime supplies the locale props like any other slot entry. (Kept here so
 * the JSX lives in a .tsx module.)
 */
export function createTurnNotifyCardEntry(
  scope: ClientSettingsScope<TurnNotifyConfig>,
): (props: PropsLocale<CardKeys>) => ReactElement {
  return (props) => <TurnNotifySettingsCard scope={scope} t={props.t} />
}
