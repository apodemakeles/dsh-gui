// turn-notify feature — bounded event queue behind the long-poll endpoint.
//
// The host pushes turn-completion events as they fire; the Electron shell
// polls `GET /api/turn-notify/events` (the exact-route dispatch is buffered,
// so the handler resolves its held response when events arrive or the wait
// times out). Pure logic, injectable timers — no Cordis, no Electron.

import type { TurnNotifyEvent } from '../shared/protocol.ts'

export interface TurnNotifyQueueOptions {
  /** Drop the OLDEST event beyond the cap: live signals beat stale ones. */
  limit?: number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

interface Waiter {
  deliver: (events: TurnNotifyEvent[]) => void
  timer: ReturnType<typeof setTimeout>
}

export class TurnNotifyQueue {
  private readonly limit: number
  private readonly setTimeoutFn: typeof setTimeout
  private readonly clearTimeoutFn: typeof clearTimeout
  private pending: TurnNotifyEvent[] = []
  private waiters: Waiter[] = []

  constructor(options: TurnNotifyQueueOptions = {}) {
    this.limit = options.limit ?? 32
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout
  }

  /** Enqueue one event, waking a held poll if any. */
  push(event: TurnNotifyEvent): void {
    if (this.pending.length >= this.limit) this.pending.shift()
    this.pending.push(event)
    const waiter = this.waiters.shift()
    if (waiter !== undefined) {
      this.clearTimeoutFn(waiter.timer)
      waiter.deliver(this.drain())
    }
  }

  /**
   * Take the queued events, or hold until one arrives / the wait elapses.
   * A dropped client just lets the waiter time out (bounded hold).
   */
  async poll(waitMs: number): Promise<TurnNotifyEvent[]> {
    if (this.pending.length > 0) return this.drain()
    if (waitMs <= 0) return []
    return new Promise((resolve) => {
      const waiter: Waiter = {
        deliver: resolve,
        timer: this.setTimeoutFn(() => {
          const index = this.waiters.indexOf(waiter)
          if (index >= 0) this.waiters.splice(index, 1)
          resolve([])
        }, waitMs),
      }
      this.waiters.push(waiter)
    })
  }

  /** Take everything queued now. */
  drain(): TurnNotifyEvent[] {
    const events = this.pending
    this.pending = []
    return events
  }

  /** Drop everything (feature disposal); release held polls empty. */
  clear(): void {
    this.pending = []
    const waiters = this.waiters
    this.waiters = []
    for (const waiter of waiters) {
      this.clearTimeoutFn(waiter.timer)
      waiter.deliver([])
    }
  }
}
