import { StateCreator } from 'zustand'
import * as timeline from '../../core/domain/latency/latencyTimeline'

export type { TurnTiming } from '../../core/domain/latency/latencyTimeline'

export interface LatencyState {
  turns: timeline.TurnTiming[]
  // actions
  markUserStart: () => void
  markUserStop: () => void
  markStt: () => void
  markServerEnter: () => void
  markServerSpeak: () => void
  clearLatency: () => void
}

export const createLatencySlice: StateCreator<LatencyState, [], [], LatencyState> = (set) => ({
  turns: [],
  markUserStart: () => set((s) => ({ turns: timeline.markUserStart(s.turns) })),
  markUserStop: () => set((s) => ({ turns: timeline.markUserStop(s.turns) })),
  markStt: () => set((s) => ({ turns: timeline.markStt(s.turns) })),
  markServerEnter: () => set((s) => ({ turns: timeline.markServerEnter(s.turns) })),
  markServerSpeak: () => set((s) => {
    const turns = timeline.markServerSpeak(s.turns)
    return turns === s.turns ? s : { turns }
  }),
  clearLatency: () => set({ turns: [] }),
})
