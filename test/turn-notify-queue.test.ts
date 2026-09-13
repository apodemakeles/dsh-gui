import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TurnNotifyQueue } from '../src/features/turn-notify/host/queue.ts'

const event = (n: number) => ({ sessionId: `s-${n}`, title: `会话 ${n}`, outcome: 'ok' as const })

describe('TurnNotifyQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('drains immediately when events are already queued', async () => {
    const queue = new TurnNotifyQueue()
    queue.push(event(1))
    queue.push(event(2))
    await expect(queue.poll(0)).resolves.toEqual([event(1), event(2)])
    await expect(queue.poll(0)).resolves.toEqual([])
  })

  it('wakes a held poll when an event arrives', async () => {
    const queue = new TurnNotifyQueue()
    const pending = queue.poll(25_000)
    queue.push(event(7))
    await expect(pending).resolves.toEqual([event(7)])
  })

  it('resolves a held poll empty when the wait elapses', async () => {
    const queue = new TurnNotifyQueue()
    const pending = queue.poll(25_000)
    const assertion = expect(pending).resolves.toEqual([])
    await vi.advanceTimersByTimeAsync(25_000)
    await assertion
  })

  it('drops the oldest event beyond the cap', () => {
    const queue = new TurnNotifyQueue({ limit: 2 })
    queue.push(event(1))
    queue.push(event(2))
    queue.push(event(3))
    expect(queue.poll(0)).resolves.toEqual([event(2), event(3)])
  })

  it('clear() releases held polls empty', async () => {
    const queue = new TurnNotifyQueue()
    const pending = queue.poll(25_000)
    const assertion = expect(pending).resolves.toEqual([])
    queue.clear()
    await assertion
  })

  it('clear() drops events queued without a poller', async () => {
    const queue = new TurnNotifyQueue()
    queue.push(event(1))
    queue.clear()
    await expect(queue.poll(0)).resolves.toEqual([])
  })

  it('serves two held polls in arrival order', async () => {
    const queue = new TurnNotifyQueue()
    const first = queue.poll(25_000)
    const second = queue.poll(25_000)
    queue.push(event(1))
    await expect(first).resolves.toEqual([event(1)])
    queue.push(event(2))
    await expect(second).resolves.toEqual([event(2)])
  })
})
