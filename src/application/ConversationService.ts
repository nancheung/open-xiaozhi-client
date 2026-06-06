// 会话编排：拥有会话状态机并执行其 effects（麦克风、listen/abort 发送）。
// 是会话机唯一触碰副作用的地方。

import { MachineRunner } from '../core/fsm/defineMachine'
import { createConversationMachine } from '../core/domain/conversation/conversationMachine'
import type { TurnEffect, TurnEvent } from '../core/domain/conversation/conversationTypes'
import type { ListenMode, DomainEvent } from '../core/events/domainEvents'
import type { EventBus } from '../core/events/eventBus'
import type { Transport } from '../core/ports/Transport'
import type { AudioInputPort } from '../core/ports/AudioIoPort'
import { buildAbort, buildListen } from '../core/domain/protocol/messages'
import type { TurnContext, TurnState } from '../core/domain/conversation/conversationTypes'

export class ConversationService {
  private readonly runner: MachineRunner<TurnState, TurnContext, TurnEvent, TurnEffect>

  constructor(
    private readonly transport: Transport,
    private readonly audioInput: AudioInputPort,
    private readonly getSessionId: () => string | null,
    private readonly bus: EventBus<DomainEvent>,
    initialMode: ListenMode,
  ) {
    this.runner = new MachineRunner(createConversationMachine(initialMode), (f) => this.exec(f))
  }

  send(ev: TurnEvent): void { this.runner.send(ev) }
  get state(): string { return this.runner.state }

  private exec(f: TurnEffect): void {
    switch (f.kind) {
      case 'startMic':
        void this.audioInput.start((frame) => this.onCapturedFrame(frame))
          .catch(() => this.runner.send({ type: 'MIC_FAILED' }))
        break
      case 'stopMic':
        this.audioInput.stop()
        break
      case 'sendListen': {
        const sid = this.getSessionId()
        if (!sid) break
        const msg = buildListen(f.state, sid, f.mode ? { mode: f.mode } : undefined)
        this.transport.sendText(JSON.stringify(msg))
        this.bus.emit({ type: 'Log', direction: 'out', data: msg })
        this.bus.emit(f.state === 'start' ? { type: 'MarkUserStart' } : { type: 'MarkUserStop' })
        break
      }
      case 'sendAbort': {
        const sid = this.getSessionId()
        if (!sid) break
        const msg = buildAbort(sid, f.reason)
        this.transport.sendText(JSON.stringify(msg))
        this.bus.emit({ type: 'Log', direction: 'out', data: msg })
        this.bus.emit({ type: 'AssistantTurnInterrupted' })
        break
      }
      case 'emit':
        this.bus.emit(f.event)
        break
    }
  }

  private onCapturedFrame(frame: Uint8Array): void {
    this.transport.sendBinary(frame)
    this.bus.emit({ type: 'BinaryLogged', direction: 'binary-out', frame })
    this.bus.emit({ type: 'AudioFrameCaptured', frame })
  }
}
