/**
 * Local client-plugin contract, replacing the types that used to come from
 * `@deepseek-ai/dsh-client-runtime/client` + `@deepseek-ai/dsh-client-ui-slots`
 * (both packages are gone since dsh 0.1.5). Structural on purpose: the runtime
 * provides these members on the real context; this shape only pins what this
 * bundle's client code touches, so upstream slot typing can drift freely.
 */
import type { ComponentType } from 'react'

/** A slot contribution registered under a name + consumer id. */
export interface SlotRegistration {
  name: string
  id: string
  order?: number
  locale?: string
  /** Keyed-slot key (e.g. `settings.plugin.item` dispatches by settings namespace). */
  key?: string
}

export interface ClientSlots {
  /** Register a factory that contributes (and can re-contrib) one slot. */
  inject(slot: string, factory: () => unknown): unknown
  /** Mount a component into a slot; returns its disposer. */
  register<T>(options: SlotRegistration, component: ComponentType<T>): () => void
}

export interface ClientLocale {
  /** Register one namespace's dictionaries keyed by locale tag ('zh'/'en'). */
  register(namespace: string, locales: Record<string, Record<string, string>>): unknown
}

/** Reactive mirror of one settings namespace (the runtime's settingsScope.bind). */
export interface ClientSettingsScope<T> {
  getSnapshot(): ClientSettingsSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** Narrowed slice of the runtime's SettingsScopeSnapshot. */
export interface ClientSettingsSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
}

export interface ClientSessions {
  /** Open (and focus) a session by id; the id must be in the list. */
  open(sessionId: string): unknown
}

export interface ClientContext {
  effect(task: () => unknown, name?: string): void
  slots: ClientSlots
  locale: ClientLocale
  /** Present when the composed runtime mounts the settings transport. */
  settingsScope?: { bind<T>(spec: { namespace: string }): ClientSettingsScope<T> }
  /** Present when the composed runtime mounts the sessions service. */
  sessions?: ClientSessions
}

/** Slot-component props: the component declares its dictionary's key union;
 * the shell injects the active locale tag plus the bound `t` lookup. */
export interface PropsLocale<Keys extends string = string> {
  locale?: string
  t: (key: Keys, vars?: Record<string, string | number>) => string
}
