// 组合根：装配端口、状态机编排与服务，暴露 dispatch(command) 与 subscribe(event)。
// UI 只与本类交互：dispatch 命令、订阅领域事件（经投影写入只读视图模型）。

import { EventBus } from '../core/events/eventBus'
import type { Command } from '../core/events/commands'
import type { DomainEvent, ListenMode } from '../core/events/domainEvents'
import type { TransportListener, Transport } from '../core/ports/Transport'
import type { ProvisioningPort } from '../core/ports/ProvisioningPort'
import type { AudioInputPort, AudioOutputPort } from '../core/ports/AudioIoPort'
import type { ClockPort } from '../core/ports/ClockPort'
import type { ConnectConfig } from '../core/domain/connection/connectionTypes'
import { buildServerAction } from '../core/domain/protocol/messages'
import { SessionOrchestrator, type HelloParams } from './SessionOrchestrator'
import { ConversationService } from './ConversationService'
import { McpService } from './McpService'
import { InboundRouter } from './InboundRouter'

export interface DeviceCommandHandlers {
  setVolume(value: number): void
  setBrightness(value: number): void
  setTheme(theme: 'light' | 'dark'): void
  enableCamera(): void
  disableCamera(): void
}

export interface AppRuntimeDeps {
  transport: Transport
  provisioning: ProvisioningPort
  audioInput: AudioInputPort
  audioOutput: AudioOutputPort
  clock: ClockPort
  getConnectConfig: () => ConnectConfig
  getHelloParams: () => HelloParams
  initialMode: ListenMode
  device: DeviceCommandHandlers
}

export class AppRuntime {
  readonly bus = new EventBus<DomainEvent>()
  private readonly orchestrator: SessionOrchestrator
  private readonly conversation: ConversationService
  private readonly mcp: McpService

  constructor(private readonly deps: AppRuntimeDeps) {
    this.orchestrator = new SessionOrchestrator({
      transport: deps.transport,
      provisioning: deps.provisioning,
      audioOutput: deps.audioOutput,
      clock: deps.clock,
      bus: this.bus,
      getHelloParams: deps.getHelloParams,
      initialConfig: deps.getConnectConfig(),
    })

    this.conversation = new ConversationService(
      deps.transport, deps.audioInput, () => this.orchestrator.getSessionId(), this.bus, deps.initialMode,
    )

    this.mcp = new McpService(
      deps.transport, () => this.orchestrator.getSessionId(), this.bus,
      () => this.orchestrator.send({ type: 'MCP_READY' }),
    )

    const router = new InboundRouter(
      (ev) => this.orchestrator.send(ev),
      (ev) => this.conversation.send(ev),
      (msg) => this.mcp.handle(msg),
      this.bus,
    )

    const listener: TransportListener = {
      onOpen: () => this.orchestrator.send({ type: 'WS_OPEN' }),
      onText: (raw) => router.handleText(raw),
      onBinary: (frame) => router.handleBinary(frame),
      onError: (message) => this.orchestrator.send({ type: 'WS_ERROR', message }),
      onClose: (code, reason) => this.orchestrator.send({ type: 'WS_CLOSE', code, reason }),
    }
    this.orchestrator.setListener(listener)

    // 跨切面订阅：播放下行音频；连接重置时通知会话机停麦回 idle
    this.bus.subscribe((e) => {
      if (e.type === 'AudioFrameReceived') this.deps.audioOutput.playFrame(e.frame)
      else if (e.type === 'ConnectionReset') this.conversation.send({ type: 'SESSION_LOST' })
    })
  }

  subscribe(listener: (e: DomainEvent) => void): () => void {
    return this.bus.subscribe(listener)
  }

  get connectionState(): string { return this.orchestrator.state }
  get conversationState(): string { return this.conversation.state }

  dispatch(cmd: Command): void {
    switch (cmd.type) {
      case 'Connect':
        this.orchestrator.send({ type: 'CONNECT', config: this.deps.getConnectConfig() })
        break
      case 'Disconnect':
        this.orchestrator.send({ type: 'DISCONNECT' })
        break
      case 'ToggleMic':
        if (this.orchestrator.state === 'ready' || this.conversation.state !== 'idle') {
          this.conversation.send({ type: 'MIC_PRESS' })
        }
        break
      case 'Abort':
        this.conversation.send({ type: 'ABORT_PRESS', reason: cmd.reason })
        break
      case 'SetListenMode':
        this.conversation.send({ type: 'SET_MODE', mode: cmd.mode })
        break
      case 'SendRawJson':
        this.deps.transport.sendText(JSON.stringify(cmd.payload))
        this.bus.emit({ type: 'Log', direction: 'out', data: cmd.payload })
        break
      case 'ServerAction': {
        const sid = this.orchestrator.getSessionId()
        if (!sid) break
        const msg = buildServerAction(sid, cmd.action, cmd.secret)
        this.deps.transport.sendText(JSON.stringify(msg))
        this.bus.emit({ type: 'Log', direction: 'out', data: msg })
        break
      }
      case 'SetVolume': this.deps.device.setVolume(cmd.value); break
      case 'SetBrightness': this.deps.device.setBrightness(cmd.value); break
      case 'SetTheme': this.deps.device.setTheme(cmd.value); break
      case 'EnableCamera': this.deps.device.enableCamera(); break
      case 'DisableCamera': this.deps.device.disableCamera(); break
      case 'ResumePlayback': this.deps.audioOutput.resume(); break
    }
  }
}
