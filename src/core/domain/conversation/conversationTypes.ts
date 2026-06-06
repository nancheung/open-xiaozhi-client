import type { DomainEvent, ListenMode } from '../../events/domainEvents'

export type TurnState = 'idle' | 'listening' | 'speaking' | 'fullDuplex'
//  idle       : 未录音、无 TTS
//  listening  : 麦克风开启、尚无 TTS
//  speaking   : TTS 播放中、麦克风关闭（半双工：manual + auto）
//  fullDuplex : TTS 播放中且麦克风保持开启（realtime 全双工）

export interface TurnContext {
  mode: ListenMode
  autoRestart: boolean   // 取代原模块级 autoRestartListening 标志
  ttsActive: boolean
}

export type TurnEvent =
  | { type: 'MIC_PRESS' }
  | { type: 'ABORT_PRESS'; reason?: 'wake_word_detected' }
  | { type: 'SET_MODE'; mode: ListenMode }
  | { type: 'TTS_START' }
  | { type: 'TTS_STOP' }
  | { type: 'STT'; text: string; internalTool: boolean }
  | { type: 'MIC_FAILED' }
  | { type: 'SESSION_LOST' }

export type TurnEffect =
  | { kind: 'startMic' }
  | { kind: 'stopMic' }
  | { kind: 'sendListen'; state: 'start' | 'stop'; mode?: ListenMode }
  | { kind: 'sendAbort'; reason?: 'wake_word_detected' }
  | { kind: 'emit'; event: DomainEvent }
