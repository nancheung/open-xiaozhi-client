// 领域事件：由 application 层（状态机 emit effect、入站路由、音频适配器）产生，
// 单向投影到只读视图模型（Zustand）并驱动其他服务。UI 永远不直接产生这些事件。

import type {
  AlertMessage, EmotionType, IoTCommandMessage,
} from '../domain/protocol/messages'
import type { ActivationPayload } from '../domain/connection/connectionTypes'

export type ListenMode = 'auto' | 'manual' | 'realtime'

export type LogDirection = 'in' | 'out' | 'system'

export type DomainEvent =
  // ── 连接生命周期 ──────────────────────────────────────────
  | { type: 'OtaRequested'; url: string }
  | { type: 'ActivationRequired'; payload: ActivationPayload }
  | { type: 'ActivationCleared' }
  | { type: 'WsInfoResolved'; url: string; token: string | null }
  | { type: 'ConnectionStatusChanged'; status: ConnectionStatus }
  | { type: 'SessionEstablished'; sessionId: string; sampleRate: number }
  | { type: 'ConnectionError'; message: string }
  | { type: 'ConnectionReset' }
  // ── 会话 / 轮次 ───────────────────────────────────────────
  | { type: 'SttReceived'; text: string; internalTool: boolean }
  | { type: 'LlmEmotion'; emotion: EmotionType; emoji: string }
  | { type: 'TtsStarted' }
  | { type: 'TtsSentence'; text: string }
  | { type: 'TtsStopped' }
  | { type: 'AudioFrameReceived'; frame: Uint8Array }   // 入站 opus（驱动播放）
  | { type: 'AudioFrameCaptured'; frame: Uint8Array }   // 出站 opus（来自麦克风适配器）
  | { type: 'TurnStateChanged'; recording: boolean; playing: boolean; ttsActive: boolean }
  | { type: 'ListenModeChanged'; mode: ListenMode }
  | { type: 'AssistantTurnInterrupted' }      // 主动 abort：立即定稿当前助手轮
  | { type: 'AudioError'; message: string | null }
  | { type: 'AudioContextSuspended'; suspended: boolean }
  // ── 耗时打点 ─────────────────────────────────────────────
  | { type: 'MarkUserStart' }
  | { type: 'MarkUserStop' }
  | { type: 'MarkStt' }
  | { type: 'MarkServerEnter' }
  | { type: 'MarkServerSpeak' }
  // ── 其它入站 ─────────────────────────────────────────────
  | { type: 'IotCommand'; cmd: IoTCommandMessage }
  | { type: 'Alert'; alert: AlertMessage }
  | { type: 'ServerResult'; status: string; message: string }
  // ── 协议日志 ─────────────────────────────────────────────
  | { type: 'Log'; direction: LogDirection; data: unknown }
  | { type: 'BinaryLogged'; direction: 'binary-in' | 'binary-out'; frame: Uint8Array }
  // ── 设备 / 视觉 ──────────────────────────────────────────
  | { type: 'VisionEndpoint'; url: string; token: string | null }
  | { type: 'VisionCleared' }
  | { type: 'PhotoCaptured'; url: string | null }
  | { type: 'DeviceVolumeChanged'; value: number }
  | { type: 'DeviceBrightnessChanged'; value: number }
  | { type: 'DeviceThemeChanged'; value: 'light' | 'dark' }
  | { type: 'CameraStateChanged'; enabled?: boolean; active?: boolean; error?: string | null }

// 连接对外暴露的视图状态（由连接状态机映射而来）。
export type ConnectionStatus =
  | 'idle' | 'ota_fetching' | 'activation_required' | 'activating'
  | 'ws_connecting' | 'handshaking' | 'mcp_init' | 'ready' | 'error'
