// 入站消息路由：把传输层抛上来的原始文本/二进制翻译成对状态机的事件与领域事件。
// 取代原 wsManager.handleText / handleBinary 的巨型 if 分发。

import type { ConnEvent } from '../core/domain/connection/connectionTypes'
import type { TurnEvent } from '../core/domain/conversation/conversationTypes'
import type { DomainEvent } from '../core/events/domainEvents'
import type { EventBus } from '../core/events/eventBus'
import {
  EMOTION_MAP,
  isAlertMessage, isIoTCommand, isLLMMessage, isMCPMessage, isPongMessage,
  isServerHello, isServerResultMessage, isSTTMessage, isTTSMessage,
  type MCPMessage,
} from '../core/domain/protocol/messages'

function isInternalToolSTT(text: string): boolean {
  return text.trimStart().startsWith('%')
}

export class InboundRouter {
  constructor(
    private readonly conn: (ev: ConnEvent) => void,
    private readonly conversation: (ev: TurnEvent) => void,
    private readonly mcp: (msg: MCPMessage) => void,
    private readonly bus: EventBus<DomainEvent>,
  ) {}

  handleText(raw: string): void {
    let msg: unknown
    try {
      msg = JSON.parse(raw)
    } catch {
      this.bus.emit({ type: 'Log', direction: 'in', data: raw })
      return
    }

    this.bus.emit({ type: 'Log', direction: 'in', data: msg })

    if (isServerHello(msg)) {
      this.conn({ type: 'SERVER_HELLO', sessionId: msg.session_id, sampleRate: msg.audio_params.sample_rate })
      return
    }
    if (isSTTMessage(msg)) {
      this.conversation({ type: 'STT', text: msg.text, internalTool: isInternalToolSTT(msg.text) })
      return
    }
    if (isLLMMessage(msg)) {
      this.bus.emit({ type: 'LlmEmotion', emotion: msg.emotion, emoji: EMOTION_MAP[msg.emotion] ?? '😶' })
      return
    }
    if (isTTSMessage(msg)) {
      if (msg.state === 'start') {
        this.conversation({ type: 'TTS_START' })
      } else if (msg.state === 'sentence_start' && msg.text) {
        this.bus.emit({ type: 'MarkServerSpeak' })
        this.bus.emit({ type: 'TtsSentence', text: msg.text })
      } else if (msg.state === 'stop') {
        this.conversation({ type: 'TTS_STOP' })
      }
      return
    }
    if (isMCPMessage(msg)) { this.mcp(msg); return }
    if (isIoTCommand(msg)) { this.bus.emit({ type: 'IotCommand', cmd: msg }); return }
    if (isPongMessage(msg)) return
    if (isAlertMessage(msg)) { this.bus.emit({ type: 'Alert', alert: msg }); return }
    if (isServerResultMessage(msg)) {
      this.bus.emit({ type: 'ServerResult', status: msg.status, message: msg.message })
      return
    }
  }

  handleBinary(frame: Uint8Array): void {
    this.bus.emit({ type: 'MarkServerSpeak' })
    this.bus.emit({ type: 'BinaryLogged', direction: 'binary-in', frame })
    this.bus.emit({ type: 'AudioFrameReceived', frame })
  }
}
