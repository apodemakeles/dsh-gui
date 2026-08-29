/**
 * Browser half of dsh-gui: the composed client entry every feature module's
 * UI registers into (one package = one client bundle served at
 * /plugins/dsh-gui/client.js). Adding a feature means adding its client
 * registration here — never a second dsh.client declaration.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { applyTokenUsageClient } from '../features/token-usage/client/index.ts'

/** Required client services: the slot registry and the locale dictionary. */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  applyTokenUsageClient(ctx)
}
