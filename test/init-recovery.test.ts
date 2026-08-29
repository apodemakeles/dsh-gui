// Commit 6 gate: initialization, run epoch and exception recovery coordinator.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { LifecycleIdentity } from '../src/features/token-usage/durable/contracts.ts'
import { UsageCollector } from '../src/features/token-usage/durable/collector.ts'
import { InitRecoveryCoordinator, SqliteCoordinatorStore, type PersistenceLike } from '../src/features/token-usage/durable/init-recovery.ts'
import { SqliteUsageStore } from '../src/features/token-usage/durable/sqlite-store.ts'
import type { UsageWorkerClient } from '../src/features/token-usage/durable/worker-client.ts'

let dir: string
let store: SqliteUsageStore

function identity(sessionId = 's1', createdAt = 1000, cwd = '/tmp/project'): LifecycleIdentity {
  return { sessionId, createdAtMs: createdAt, cwd }
}

function usageMessage(seq: number, turn = 1, step = 1, input = 10, output = 5): SessionEvent {
  return { type: 'assistant/message', seq, time: Date.now(), data: { turn, step, message: {}, usage: { inputTokens: input, outputTokens: output } } } as unknown as SessionEvent
}

function fakePersistence(sessions: Map<string, { revision: string; events: SessionEvent[] }>): PersistenceLike {
  return {
    async listSnapshots() {
      return [...sessions.entries()].map(([id, value]) => ({
        header: { id, createdAt: 1000, cwd: '/tmp/project' },
        revision: value.revision,
      }))
    },
    async readFrom(id: string, fromSeq: number) {
      return {
        meta: { id, createdAt: 1000, cwd: '/tmp/project' },
        events: (sessions.get(id)?.events ?? []).filter((event) => event.seq >= fromSeq),
      }
    },
  }
}

function dummyCollector(): UsageCollector {
  const flush = { async flush() { return true } }
  const worker = { async project() { return { committed: true } } }
  return new UsageCollector({ generation: 'g', flush, worker, flushCooldownMs: 0, flushRetryDelaysMs: [0] })
}

function dummyWorkerClient(): UsageWorkerClient {
  return { project: async () => ({ committed: true }) } as unknown as UsageWorkerClient
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-token-dashboard-init-'))
  store = new SqliteUsageStore(join(dir, 'usage-v1.sqlite'))
})

afterEach(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('InitRecoveryCoordinator', () => {
  it('initializes new sessions from readFrom(0) and reaches ready', async () => {
    const sessions = new Map<string, { revision: string; events: SessionEvent[] }>([
      ['s1', { revision: 'r1', events: [usageMessage(0), usageMessage(1)] }],
      ['s2', { revision: 'r1', events: [usageMessage(0)] }],
    ])
    const coordinator = new InitRecoveryCoordinator({
      store: new SqliteCoordinatorStore(store),
      persistence: fakePersistence(sessions),
      collector: dummyCollector(),
      worker: dummyWorkerClient(),
      generation: 'g',
      yieldEvery: 1,
    })
    await coordinator.start()
    const progress = store.getProjectionProgress()
    expect(progress.phase).toBe('ready')
    expect(progress.completedSessions).toBe(2)
    const snap = store.snapshot({ weeks: 1, offsetWeeks: 0 }, 0)
    expect(snap.summary.all).toBe(30)
    expect(snap.summary.sessionCount).toBe(2)
    const s1Pk = store.getLifecycle(identity('s1'))!
    expect(store.getCheckpoint(s1Pk).bootstrapComplete).toBe(true)
  })

  it('recovers only revision-changed sessions after an active run', async () => {
    const sessions = new Map<string, { revision: string; events: SessionEvent[] }>([
      ['s1', { revision: 'r1', events: [usageMessage(0)] }],
    ])
    const persistence = fakePersistence(sessions)
    // Simulate a previous active epoch with an older baseline.
    const pk = store.upsertLifecycle(identity('s1'))
    store.projectBatch({
      batchId: 'old',
      hostGeneration: 'g',
      lifecycle: identity('s1'),
      fromSeq: 0,
      toSeq: 0,
      deltas: [{ kind: 'usage', seq: 0, time: Date.now(), turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5 }, final: true }],
    })
    const oldEpoch = store.beginRunEpoch()
    store.activateRunEpoch(oldEpoch, [{ lifecyclePk: pk, sourceRevision: 'r0' }])
    // New revision r1 should be recovered from checkpoint+1 with a new step.
    sessions.set('s1', { revision: 'r1', events: [usageMessage(0, 1, 1), usageMessage(1, 1, 2)] })

    const coordinator = new InitRecoveryCoordinator({
      store: new SqliteCoordinatorStore(store),
      persistence,
      collector: dummyCollector(),
      worker: dummyWorkerClient(),
      generation: 'g',
      yieldEvery: 1,
    })
    await coordinator.start()
    const snap = store.snapshot({ weeks: 1, offsetWeeks: 0 }, 0)
    expect(snap.summary.all).toBe(30) // old fact 15 + recovered tail 15
    expect(store.getProjectionProgress().phase).toBe('ready')
  })

  it('degrades when a session read fails instead of pretending ready', async () => {
    const sessions = new Map<string, { revision: string; events: SessionEvent[] }>([
      ['s1', { revision: 'r1', events: [usageMessage(0)] }],
    ])
    const persistence: PersistenceLike = {
      async listSnapshots() {
        return [{ header: { id: 's1', createdAt: 1000, cwd: '/tmp/project' }, revision: 'r1' }]
      },
      async readFrom() {
        throw new Error('boom')
      },
    }
    const coordinator = new InitRecoveryCoordinator({
      store: new SqliteCoordinatorStore(store),
      persistence,
      collector: dummyCollector(),
      worker: dummyWorkerClient(),
      generation: 'g',
      yieldEvery: 1,
    })
    await coordinator.start()
    expect(store.getProjectionProgress().phase).toBe('degraded')
    expect(store.getProjectionProgress().failedSessions).toBe(1)
  })

  it('gap sweep backfills sessions created while no collector ran, without re-reading bootstrapped ones', async () => {
    const sessions = new Map<string, { revision: string; events: SessionEvent[] }>([
      ['s1', { revision: 'r1', events: [usageMessage(0)] }],
    ])
    const reads = new Map<string, number>()
    const persistence: PersistenceLike = {
      async listSnapshots() {
        return [...sessions.entries()].map(([id, value]) => ({
          header: { id, createdAt: 1000, cwd: '/tmp/project' },
          revision: value.revision,
        }))
      },
      async readFrom(id: string, fromSeq: number) {
        reads.set(id, (reads.get(id) ?? 0) + 1)
        return {
          meta: { id, createdAt: 1000, cwd: '/tmp/project' },
          events: (sessions.get(id)?.events ?? []).filter((event) => event.seq >= fromSeq),
        }
      },
    }
    const makeCoordinator = () =>
      new InitRecoveryCoordinator({
        store: new SqliteCoordinatorStore(store),
        persistence,
        collector: dummyCollector(),
        worker: dummyWorkerClient(),
        generation: 'g',
        yieldEvery: 1,
      })

    // First run: the "old plugin" ingests s1 and shuts down cleanly.
    await makeCoordinator().start()
    const lastEpoch = store.getLastRunEpoch()
    expect(lastEpoch).not.toBeNull()
    store.markRunClean(lastEpoch!.epochId)
    reads.clear()

    // While no collector ran (gui/CLI usage), s2 appears in the log.
    sessions.set('s2', { revision: 'r1', events: [usageMessage(0, 1, 1, 7, 3)] })

    // Clean/ready boot: the sweep backfills s2 and leaves s1 untouched.
    await makeCoordinator().start()
    expect(store.getProjectionProgress().phase).toBe('ready')
    const snap = store.snapshot({ weeks: 1, offsetWeeks: 0 }, 0)
    expect(snap.summary.all).toBe(25) // s1 15 + gap session s2 10
    expect(reads.get('s1')).toBeUndefined()
    // One data read plus the empty confirming read that closes the scan.
    expect(reads.get('s2')).toBe(2)
    const s2Pk = store.getLifecycle(identity('s2'))!
    expect(store.getCheckpoint(s2Pk).bootstrapComplete).toBe(true)
  })
})
