// 连接编排：拥有连接状态机并执行其 effects（OTA/激活、传输连接、握手计时、心跳、解码器配置）。
// 是连接机唯一触碰副作用的地方，并持有当前 sessionId。

import { MachineRunner } from '../core/fsm/defineMachine'
import { createConnectionMachine } from '../core/domain/connection/connectionMachine'
import type {
  ConnContext, ConnEffect, ConnEvent, ConnState,
} from '../core/domain/connection/connectionTypes'
import type { DomainEvent } from '../core/events/domainEvents'
import type { EventBus } from '../core/events/eventBus'
import type { Transport, TransportListener } from '../core/ports/Transport'
import type { ProvisioningPort } from '../core/ports/ProvisioningPort'
import type { AudioOutputPort } from '../core/ports/AudioIoPort'
import type { ClockPort } from '../core/ports/ClockPort'
import { buildPing } from '../core/domain/protocol/messages'

export interface HelloParams {
  version: number
  features: Record<string, unknown>
  audio: Record<string, unknown>
}

export interface SessionOrchestratorDeps {
  transport: Transport
  provisioning: ProvisioningPort
  audioOutput: AudioOutputPort
  clock: ClockPort
  bus: EventBus<DomainEvent>
  getHelloParams: () => HelloParams
  initialConfig: { otaUrl: string; deviceId: string; clientId: string; mcpRequired: boolean; handshakeTimeoutMs: number; heartbeatIntervalMs: number }
}

export class SessionOrchestrator {
  private readonly runner: MachineRunner<ConnState, ConnContext, ConnEvent, ConnEffect>
  private heartbeatId: number | null = null
  private handshakeId: number | null = null
  private sessionId: string | null = null
  private lastOta: import('../core/ports/ProvisioningPort').OtaResult | null = null
  private listener: TransportListener | null = null

  constructor(private readonly deps: SessionOrchestratorDeps) {
    this.runner = new MachineRunner(createConnectionMachine(deps.initialConfig), (f) => this.exec(f))
  }

  setListener(listener: TransportListener): void { this.listener = listener }
  send(ev: ConnEvent): void { this.runner.send(ev) }
  get state(): ConnState { return this.runner.state }
  getSessionId(): string | null { return this.sessionId }

  private exec(f: ConnEffect): void {
    switch (f.kind) {
      case 'fetchOta': void this.doFetchOta(); break
      case 'runActivation': void this.doRunActivation(f.timeoutMs); break
      case 'connectTransport': this.doConnect(); break
      case 'sendHello': this.doSendHello(); break
      case 'startHandshakeTimer':
        this.handshakeId = this.deps.clock.setTimeout(() => this.runner.send({ type: 'HANDSHAKE_TIMEOUT' }), f.ms)
        break
      case 'clearHandshakeTimer':
        if (this.handshakeId != null) { this.deps.clock.clearTimeout(this.handshakeId); this.handshakeId = null }
        break
      case 'startHeartbeat': this.startHeartbeat(f.ms); break
      case 'stopHeartbeat': this.stopHeartbeat(); break
      case 'initDecoder': this.deps.audioOutput.configure(f.sampleRate); break
      case 'closeTransport': this.deps.transport.close(); break
      case 'emit':
        if (f.event.type === 'SessionEstablished') this.sessionId = f.event.sessionId
        if (f.event.type === 'ConnectionReset') { this.sessionId = null; this.deps.audioOutput.reset() }
        this.deps.bus.emit(f.event)
        break
    }
  }

  private async doFetchOta(): Promise<void> {
    const { otaUrl, deviceId, clientId } = this.runner.context
    try {
      const result = await this.deps.provisioning.fetchOta(otaUrl, deviceId, clientId)
      this.lastOta = result
      this.runner.send({ type: 'OTA_OK', result })
    } catch (e) {
      this.runner.send({ type: 'OTA_FAIL', message: `OTA 失败: ${(e as Error).message}` })
    }
  }

  private async doRunActivation(timeoutMs?: number): Promise<void> {
    const { otaUrl, deviceId, clientId } = this.runner.context
    const ok = await this.deps.provisioning.runActivation(otaUrl, deviceId, clientId, {
      timeoutMs,
      isCancelled: () => this.runner.state === 'idle' || this.runner.state === 'error',
    })
    if (this.runner.state !== 'activating') return  // 已被取消/状态已变
    if (!ok) { this.runner.send({ type: 'ACTIVATION_FAIL', message: '设备激活失败' }); return }
    let result = this.lastOta
    if (!result?.websocket) {
      try {
        result = await this.deps.provisioning.fetchOta(otaUrl, deviceId, clientId)
      } catch (e) {
        this.runner.send({ type: 'ACTIVATION_FAIL', message: `OTA 失败: ${(e as Error).message}` })
        return
      }
    }
    this.runner.send({ type: 'ACTIVATION_OK', result })
  }

  private doConnect(): void {
    const ws = this.runner.context.wsInfo
    if (!ws || !this.listener) return
    this.deps.transport.connect(ws, this.listener)
  }

  private doSendHello(): void {
    const p = this.deps.getHelloParams()
    const hello = { type: 'hello', version: p.version, transport: 'websocket', features: p.features, audio_params: p.audio }
    this.deps.transport.sendText(JSON.stringify(hello))
    this.deps.bus.emit({ type: 'Log', direction: 'out', data: hello })
  }

  private startHeartbeat(ms: number): void {
    this.stopHeartbeat()
    this.heartbeatId = this.deps.clock.setInterval(() => {
      const sid = this.sessionId
      if (sid) {
        const ping = buildPing(sid)
        this.deps.transport.sendText(JSON.stringify(ping))
        this.deps.bus.emit({ type: 'Log', direction: 'out', data: ping })
      }
    }, ms)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatId != null) { this.deps.clock.clearInterval(this.heartbeatId); this.heartbeatId = null }
  }
}
