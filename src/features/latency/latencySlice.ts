import { StateCreator } from 'zustand'

/**
 * 一轮语音交互的耗时时间点（均为 Date.now() 毫秒，未发生则为 null）。
 * 核心关注：用户说完话(userStopAt) → 服务器开始说话(serverSpeakAt) 的等待耗时。
 */
export interface TurnTiming {
  id: number
  userStartAt: number | null   // 用户开始说话（listen 'start'；实时/服务器发起时为 null）
  userStopAt: number | null    // 用户说完话（listen 'stop'，或自动/实时模式回退 = sttAt）
  sttAt: number | null         // STT 文本到达
  serverEnterAt: number | null // tts.state==='start'：服务器进入说话状态
  serverSpeakAt: number | null // 首帧服务器音频 / 首个 sentence_start：服务器开始说话
}

const MAX_TURNS = 50

let _id = 0
const nextTurnId = () => ++_id

// 「开放轮」= 末轮且尚未产生首帧音频（serverSpeakAt 为 null）
const isOpen = (t?: TurnTiming): t is TurnTiming => !!t && t.serverSpeakAt === null

const replaceLast = (ts: TurnTiming[], u: TurnTiming): TurnTiming[] => [...ts.slice(0, -1), u]

const newTurn = (p: Partial<TurnTiming>): TurnTiming => ({
  id: nextTurnId(),
  userStartAt: null,
  userStopAt: null,
  sttAt: null,
  serverEnterAt: null,
  serverSpeakAt: null,
  ...p,
})

// 若末轮已完成/不存在则补开一个空轮，保证有开放轮可写（覆盖实时第 2 轮、服务器问候等场景）
function ensureOpenTurn(turns: TurnTiming[]): TurnTiming[] {
  return isOpen(turns[turns.length - 1])
    ? turns
    : [...turns, newTurn({})].slice(-MAX_TURNS)
}

export interface LatencyState {
  turns: TurnTiming[]
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

  // 唯一无条件开新轮的入口：确保新一次用户说话不会并入上一轮
  markUserStart: () => set((s) => ({
    turns: [...s.turns, newTurn({ userStartAt: Date.now() })].slice(-MAX_TURNS),
  })),

  markUserStop: () => set((s) => {
    const ts = ensureOpenTurn(s.turns)
    const last = ts[ts.length - 1]
    if (last.userStopAt !== null) return { turns: ts }
    return { turns: replaceLast(ts, { ...last, userStopAt: Date.now() }) }
  }),

  // STT：设 sttAt（首次胜），并回退 userStopAt（自动/实时模式无 listen 'stop'）
  markStt: () => set((s) => {
    const ts = ensureOpenTurn(s.turns)
    const last = ts[ts.length - 1]
    const now = Date.now()
    return { turns: replaceLast(ts, {
      ...last,
      sttAt: last.sttAt ?? now,
      userStopAt: last.userStopAt ?? now,
    }) }
  }),

  markServerEnter: () => set((s) => {
    const ts = ensureOpenTurn(s.turns)
    const last = ts[ts.length - 1]
    if (last.serverEnterAt !== null) return { turns: ts }
    return { turns: replaceLast(ts, { ...last, serverEnterAt: Date.now() }) }
  }),

  // 首帧音频 / 首个 sentence_start：设 serverSpeakAt（首次胜），设置即令该轮「完成」。
  // 注意：handleBinary 每帧都会调用本方法，故仅更新「开放轮」、绝不新开轮，
  // 否则一轮 TTS 的后续音频帧会被误判为新轮。
  markServerSpeak: () => set((s) => {
    const last = s.turns[s.turns.length - 1]
    if (!isOpen(last)) return s
    return { turns: replaceLast(s.turns, { ...last, serverSpeakAt: Date.now() }) }
  }),

  clearLatency: () => set({ turns: [] }),
})
