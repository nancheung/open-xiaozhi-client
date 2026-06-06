import type { TurnTiming } from './latencySlice'

/** HH:mm:ss.mmm（参照 MessageLog），空值显示 — */
export function formatTime(ts: number | null): string {
  if (ts == null) return '—'
  const ms = String(ts % 1000).padStart(3, '0')
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + '.' + ms
}

/** <1000 显示 Nms，≥1000 显示 N.NNs，空值显示 — */
export function formatMs(ms: number | null): string {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

/** 两个时间点之差（任一为空则 null） */
export const delta = (a: number | null, b: number | null): number | null =>
  a != null && b != null ? b - a : null

export interface TurnDeltas {
  recording: number | null   // 录音时长 = 用户开始 → 用户说完
  userWait: number | null    // 用户等待[核心] = 用户说完 → 服务器开始说话
  enterDelay: number | null  // 进入状态延迟 = 用户说完 → 服务器进入说话
  speakDelay: number | null  // 出声延迟 = 服务器进入说话 → 服务器开始说话
}

export function turnDeltas(t: TurnTiming): TurnDeltas {
  return {
    recording: delta(t.userStartAt, t.userStopAt),
    userWait: delta(t.userStopAt, t.serverSpeakAt),
    enterDelay: delta(t.userStopAt, t.serverEnterAt),
    speakDelay: delta(t.serverEnterAt, t.serverSpeakAt),
  }
}

/** 实时轮：无客户端 listen 'start'，靠 STT 锚定用户说完 */
export const isRealtimeTurn = (t: TurnTiming): boolean =>
  t.userStartAt == null && t.sttAt != null
/** 服务器发起轮（如唤醒词问候）：无用户说话信号 */
export const isGreetingTurn = (t: TurnTiming): boolean =>
  t.userStopAt == null && t.sttAt == null

export function turnTag(t: TurnTiming): string {
  if (isGreetingTurn(t)) return '问候'
  if (isRealtimeTurn(t)) return '实时'
  return ''
}
