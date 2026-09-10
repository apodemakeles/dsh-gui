// Replay-aware usage fold over session events, mirroring the official
// dsh-token-meter projection semantics (research 02, §3), adapted to the
// dsh 0.1.5 V3 log format:
// - usage arrives only on assistant/message (data.usage, the step's final
//   accounting); the V2 assistant/chunk usage samples are gone from the log.
// - dedup = last sample per (turn, step) wins (replay/retry duplicates
//   overwrite rather than accumulate).
//
// Implementation note: we key by (turn, step) instead of the official
// single-slot adjacency fold, so the fold stays correct even if the log were
// ever re-ordered across a read boundary.

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsageLike, UsageSample } from '../core/types.ts'

/**
 * Fold a contiguous event log into one sample per (turn, step), last wins.
 * Returns samples sorted by event time (stable for day bucketing).
 */
export function foldUsage(events: readonly SessionEvent[]): UsageSample[] {
  const byStep = new Map<string, UsageSample>()
  let provider: string | undefined
  let model: string | undefined
  for (const event of events) {
    // Route identity comes from the request events preceding the step in seq
    // order (request/header.config or request/context carry provider/model).
    if (event.type === 'request/header') {
      const config = event.data.header.config
      if (typeof config.provider === 'string') provider = config.provider
      if (typeof config.model === 'string') model = config.model
      continue
    }
    if (event.type === 'request/context') {
      if (typeof event.data.provider === 'string') provider = event.data.provider
      if (typeof event.data.model === 'string') model = event.data.model
      continue
    }
    if (event.type === 'assistant/message') {
      const usage = event.data.usage
      if (usage !== undefined) {
        const { turn, step } = event.data
        byStep.set(turn + ':' + step, { turn, step, time: event.time, usage: usage as TokenUsageLike, provider, model })
      }
    }
  }
  return [...byStep.values()].sort((a, b) => a.time - b.time)
}

/** Merge tail samples into an existing fold (incremental refresh). */
export function mergeUsage(existing: Map<string, UsageSample>, incoming: readonly UsageSample[]): void {
  for (const sample of incoming) {
    existing.set(sample.turn + ':' + sample.step, sample)
  }
}

export function stepKey(sample: Pick<UsageSample, 'turn' | 'step'>): string {
  return sample.turn + ':' + sample.step
}