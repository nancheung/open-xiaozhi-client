import type { TransportConnectInfo } from '../../ports/Transport'
import type { OtaResult } from '../../ports/ProvisioningPort'
import type { DomainEvent } from '../../events/domainEvents'

export interface ActivationPayload {
  message: string
  [key: string]: unknown
}

export type ConnState =
  | 'idle' | 'otaFetching' | 'activationRequired' | 'activating'
  | 'wsConnecting' | 'handshaking' | 'mcpInit' | 'ready' | 'error'

export interface ConnContext {
  otaUrl: string
  deviceId: string
  clientId: string
  mcpRequired: boolean
  handshakeTimeoutMs: number
  heartbeatIntervalMs: number
  wsInfo: TransportConnectInfo | null
  sessionId: string | null
  sampleRate: number | null
  errorMessage: string | null
  activationTimeoutMs?: number
}

export type ConnEvent =
  | { type: 'CONNECT' }
  | { type: 'OTA_OK'; result: OtaResult }
  | { type: 'OTA_FAIL'; message: string }
  | { type: 'ACTIVATION_OK'; result: OtaResult }
  | { type: 'ACTIVATION_FAIL'; message: string }
  | { type: 'WS_OPEN' }
  | { type: 'SERVER_HELLO'; sessionId: string; sampleRate: number }
  | { type: 'MCP_READY' }
  | { type: 'HANDSHAKE_TIMEOUT' }
  | { type: 'WS_ERROR'; message: string }
  | { type: 'WS_CLOSE'; code: number; reason: string }
  | { type: 'DISCONNECT' }

export type ConnEffect =
  | { kind: 'fetchOta' }
  | { kind: 'runActivation'; timeoutMs?: number }
  | { kind: 'connectTransport' }
  | { kind: 'sendHello' }
  | { kind: 'startHandshakeTimer'; ms: number }
  | { kind: 'clearHandshakeTimer' }
  | { kind: 'startHeartbeat'; ms: number }
  | { kind: 'stopHeartbeat' }
  | { kind: 'initDecoder'; sampleRate: number }
  | { kind: 'closeTransport' }
  | { kind: 'emit'; event: DomainEvent }
