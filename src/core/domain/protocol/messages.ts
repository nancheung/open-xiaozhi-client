// 小智协议消息：类型定义、类型守卫与出站消息构建器。
// 此处是协议的“领域语言”，对 WS / MQTT 等传输方式无感知。

// ── 音频参数 ──────────────────────────────────────────────────────────
export interface AudioParams {
  format: 'opus'
  sample_rate: 8000 | 12000 | 16000 | 24000 | 48000
  channels: number
  frame_duration: number
}

// ── 情绪枚举 ──────────────────────────────────────────────────────────
export type EmotionType =
  | 'happy' | 'funny' | 'crying' | 'angry' | 'sad' | 'loving'
  | 'surprised' | 'shocked' | 'thinking' | 'winking' | 'delicious'
  | 'confident' | 'relaxed' | 'sleepy' | 'silly' | 'confused'
  | 'neutral' | 'laughing' | 'embarrassed' | 'cool' | 'kissy'

export const EMOTION_MAP: Record<EmotionType, string> = {
  happy: '🙂', funny: '😂', crying: '😭', angry: '😠', sad: '😔',
  loving: '😍', surprised: '😲', shocked: '😱', thinking: '🤔',
  winking: '😉', delicious: '🤤', confident: '😏', relaxed: '😌',
  sleepy: '😴', silly: '😜', confused: '🙄', neutral: '😶',
  laughing: '😆', embarrassed: '😳', cool: '😎', kissy: '😘',
}

// ── 服务器 → 客户端消息 ───────────────────────────────────────────────
export interface ServerHello {
  type: 'hello'; version: number; transport: string
  session_id: string; audio_params: AudioParams
}
export interface STTMessage { type: 'stt'; text: string; session_id: string }
export interface LLMMessage { type: 'llm'; text: string; emotion: EmotionType; session_id: string }
export interface TTSMessage {
  type: 'tts'; state: 'start' | 'sentence_start' | 'stop'
  text?: string; session_id: string
}
export interface MCPMessage {
  type: 'mcp'
  session_id?: string
  payload: {
    jsonrpc: '2.0'
    id?: number
    method?: string
    params?: Record<string, unknown>
    result?: unknown
    error?: { message: string }
  }
}
export interface IoTCommandMessage {
  type: 'iot'
  session_id?: string
  commands: Array<{ name: string; method: string; parameters?: Record<string, unknown> }>
}
export interface PongMessage { type: 'pong'; timestamp: string }
export interface AlertMessage {
  type: 'alert'; status: string; message: string; emotion?: EmotionType; session_id?: string
}
export interface ServerResultMessage {
  type: 'server'; status: 'success' | 'error'; message: string
  content?: { action: string }; session_id?: string
}
export interface SystemMessage { type: 'system'; command: string; session_id?: string }

export type ServerMessage =
  | ServerHello | STTMessage | LLMMessage | TTSMessage
  | MCPMessage | IoTCommandMessage | PongMessage
  | AlertMessage | ServerResultMessage | SystemMessage

// ── 类型守卫 ───────────────────────────────────────────────────────────
export const isServerHello = (m: unknown): m is ServerHello =>
  typeof m === 'object' && m !== null && (m as ServerHello).type === 'hello' && 'session_id' in m
export const isSTTMessage = (m: unknown): m is STTMessage =>
  typeof m === 'object' && m !== null && (m as STTMessage).type === 'stt'
export const isLLMMessage = (m: unknown): m is LLMMessage =>
  typeof m === 'object' && m !== null && (m as LLMMessage).type === 'llm'
export const isTTSMessage = (m: unknown): m is TTSMessage =>
  typeof m === 'object' && m !== null && (m as TTSMessage).type === 'tts'
export const isMCPMessage = (m: unknown): m is MCPMessage =>
  typeof m === 'object' && m !== null && (m as MCPMessage).type === 'mcp'
export const isIoTCommand = (m: unknown): m is IoTCommandMessage =>
  typeof m === 'object' && m !== null && (m as IoTCommandMessage).type === 'iot' && 'commands' in m
export const isPongMessage = (m: unknown): m is PongMessage =>
  typeof m === 'object' && m !== null && (m as PongMessage).type === 'pong'
export const isAlertMessage = (m: unknown): m is AlertMessage =>
  typeof m === 'object' && m !== null && (m as AlertMessage).type === 'alert'
export const isServerResultMessage = (m: unknown): m is ServerResultMessage =>
  typeof m === 'object' && m !== null && (m as ServerResultMessage).type === 'server' && 'status' in m
export const isSystemMessage = (m: unknown): m is SystemMessage =>
  typeof m === 'object' && m !== null && (m as SystemMessage).type === 'system'

// ── 客户端 → 服务器消息（构建函数，自动带 session_id） ────────────────
export const buildListen = (
  state: 'start' | 'stop' | 'detect',
  session_id: string,
  opts?: { mode?: 'auto' | 'manual' | 'realtime'; text?: string }
) => ({ type: 'listen' as const, session_id, state, ...opts })

// 对齐 xiaozhi-esp32（protocol.cc SendAbortSpeaking）：
// 仅唤醒词打断时携带 reason="wake_word_detected"，手动打断不带 reason。
export const buildAbort = (session_id: string, reason?: 'wake_word_detected') =>
  ({ type: 'abort' as const, session_id, ...(reason ? { reason } : {}) })

export const buildPing = (session_id: string) =>
  ({ type: 'ping' as const, session_id })

export const buildServerAction = (
  session_id: string,
  action: 'update_config' | 'restart',
  secret: string
) => ({ type: 'server' as const, session_id, action, content: { secret } })

export const buildMCPResponse = (session_id: string, payload: MCPMessage['payload']) =>
  ({ type: 'mcp' as const, session_id, payload })
