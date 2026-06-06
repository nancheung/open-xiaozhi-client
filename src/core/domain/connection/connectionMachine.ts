// 连接/会话生命周期的显式状态机。
// 取代原 wsManager 中散落的 setStatus() 与隐式分支：
//   idle → otaFetching → (activationRequired | activating) → wsConnecting
//        → handshaking → (mcpInit) → ready，以及 error / 断开重置。

import type { MachineDef } from '../../fsm/types'
import type { DomainEvent } from '../../events/domainEvents'
import type {
  ConnContext, ConnEffect, ConnEvent, ConnState,
} from './connectionTypes'

const emit = (event: DomainEvent): ConnEffect => ({ kind: 'emit', event })

// 便捷：发出连接状态变更事件
function emitStatus(
  value: 'idle' | 'ota_fetching' | 'activation_required' | 'activating'
    | 'ws_connecting' | 'handshaking' | 'mcp_init' | 'ready' | 'error',
): ConnEffect {
  return emit({ type: 'ConnectionStatusChanged', status: value })
}

const hasActivationChallenge = (_: ConnContext, ev: ConnEvent): boolean =>
  ev.type === 'OTA_OK' && !!ev.result.activation
  && typeof ev.result.activation.challenge === 'string' && ev.result.activation.challenge.length > 0

const hasActivationNoChallenge = (_: ConnContext, ev: ConnEvent): boolean =>
  ev.type === 'OTA_OK' && !!ev.result.activation
  && !(typeof ev.result.activation.challenge === 'string' && ev.result.activation.challenge.length > 0)

const hasWebsocket = (_: ConnContext, ev: ConnEvent): boolean =>
  (ev.type === 'OTA_OK' || ev.type === 'ACTIVATION_OK') && !!ev.result.websocket

function wsInfoFrom(ctx: ConnContext, ev: ConnEvent): Partial<ConnContext> {
  if ((ev.type === 'OTA_OK' || ev.type === 'ACTIVATION_OK') && ev.result.websocket) {
    return {
      wsInfo: {
        url: ev.result.websocket.url,
        token: ev.result.websocket.token || null,
        deviceId: ctx.deviceId,
        clientId: ctx.clientId,
      },
    }
  }
  return {}
}

// 进入连接握手后的共享 effects（SERVER_HELLO 命中时）
function helloEffects(ctx: ConnContext, ev: ConnEvent): ConnEffect[] {
  if (ev.type !== 'SERVER_HELLO') return []
  const fx: ConnEffect[] = [
    { kind: 'clearHandshakeTimer' },
    { kind: 'initDecoder', sampleRate: ev.sampleRate },
    emit({ type: 'SessionEstablished', sessionId: ev.sessionId, sampleRate: ev.sampleRate }),
  ]
  if (ctx.heartbeatIntervalMs > 0) fx.push({ kind: 'startHeartbeat', ms: ctx.heartbeatIntervalMs })
  return fx
}

// 断开/重置共享 effects
const teardownEffects: ConnEffect[] = [
  { kind: 'closeTransport' },
  { kind: 'stopHeartbeat' },
  { kind: 'clearHandshakeTimer' },
  emit({ type: 'ConnectionReset' }),
  emit({ type: 'VisionCleared' }),
  emitStatus('idle'),
]

// 活跃连接态下的全局转换（错误/关闭/主动断开）
const activeGlobalOn: NonNullable<MachineDef<ConnState, ConnContext, ConnEvent, ConnEffect>['states'][ConnState]['on']> = {
  WS_ERROR: {
    target: 'error',
    assign: (_, ev) => ({ errorMessage: ev.type === 'WS_ERROR' ? ev.message : null }),
    effects: (_, ev) => [
      emit({ type: 'ConnectionError', message: ev.type === 'WS_ERROR' ? ev.message : '连接错误' }),
      { kind: 'closeTransport' }, { kind: 'stopHeartbeat' }, { kind: 'clearHandshakeTimer' },
      emitStatus('error'),
    ],
  },
  WS_CLOSE: {
    target: 'idle',
    effects: (_, ev) => [
      emit({
        type: 'Log', direction: 'system',
        data: ev.type === 'WS_CLOSE' ? `连接关闭: ${ev.code} ${ev.reason || '正常关闭'}` : '连接关闭',
      }),
      ...teardownEffects,
    ],
  },
  DISCONNECT: { target: 'idle', effects: () => teardownEffects },
}

export function createConnectionMachine(initial: {
  otaUrl: string; deviceId: string; clientId: string
  mcpRequired: boolean; handshakeTimeoutMs: number; heartbeatIntervalMs: number
}): MachineDef<ConnState, ConnContext, ConnEvent, ConnEffect> {
  return {
    initial: 'idle',
    context: {
      ...initial,
      wsInfo: null, sessionId: null, sampleRate: null, errorMessage: null,
    },
    states: {
      idle: {
        on: {
          CONNECT: {
            target: 'otaFetching',
            assign: (_, ev) => ev.type === 'CONNECT'
              ? { ...ev.config, wsInfo: null, sessionId: null, errorMessage: null }
              : {},
          },
        },
      },

      otaFetching: {
        entry: (ctx) => [emit({ type: 'OtaRequested', url: ctx.otaUrl }), emitStatus('ota_fetching'), { kind: 'fetchOta' }],
        on: {
          OTA_OK: [
            {
              guard: hasActivationChallenge,
              target: 'activating',
              assign: (_, ev) => {
                const act = ev.type === 'OTA_OK' ? ev.result.activation : undefined
                return { activationTimeoutMs: typeof act?.timeout_ms === 'number' ? act.timeout_ms : undefined }
              },
              effects: (_, ev) => [
                emit({ type: 'ActivationRequired', payload: (ev as Extract<ConnEvent, { type: 'OTA_OK' }>).result.activation as never }),
                emit({ type: 'Log', direction: 'system', data: '设备激活中，正在轮询 /activate ...' }),
              ],
            },
            {
              guard: hasActivationNoChallenge,
              target: 'activationRequired',
              effects: (_, ev) => [
                emit({ type: 'ActivationRequired', payload: (ev as Extract<ConnEvent, { type: 'OTA_OK' }>).result.activation as never }),
              ],
            },
            {
              guard: hasWebsocket,
              target: 'wsConnecting',
              assign: wsInfoFrom,
            },
            {
              target: 'error',
              assign: () => ({ errorMessage: 'OTA 响应缺少 websocket 字段' }),
              effects: () => [emit({ type: 'ConnectionError', message: 'OTA 响应缺少 websocket 字段' }), emitStatus('error')],
            },
          ],
          OTA_FAIL: {
            target: 'error',
            assign: (_, ev) => ({ errorMessage: ev.type === 'OTA_FAIL' ? ev.message : null }),
            effects: (_, ev) => [emit({ type: 'ConnectionError', message: ev.type === 'OTA_FAIL' ? ev.message : 'OTA 失败' }), emitStatus('error')],
          },
          DISCONNECT: { target: 'idle', effects: () => [emit({ type: 'ConnectionReset' }), emit({ type: 'ActivationCleared' }), emitStatus('idle')] },
        },
      },

      activationRequired: {
        entry: () => [emitStatus('activation_required')],
        on: {
          DISCONNECT: { target: 'idle', effects: () => [emit({ type: 'ActivationCleared' }), emit({ type: 'ConnectionReset' }), emitStatus('idle')] },
        },
      },

      activating: {
        entry: (ctx) => [emitStatus('activating'), { kind: 'runActivation', timeoutMs: ctx.activationTimeoutMs }],
        on: {
          ACTIVATION_OK: [
            {
              guard: hasWebsocket,
              target: 'wsConnecting',
              assign: wsInfoFrom,
              effects: () => [emit({ type: 'ActivationCleared' }), emit({ type: 'Log', direction: 'system', data: '设备激活成功' })],
            },
            {
              target: 'error',
              assign: () => ({ errorMessage: 'OTA 响应缺少 websocket 字段' }),
              effects: () => [emit({ type: 'ConnectionError', message: 'OTA 响应缺少 websocket 字段' }), emitStatus('error')],
            },
          ],
          ACTIVATION_FAIL: {
            target: 'error',
            assign: (_, ev) => ({ errorMessage: ev.type === 'ACTIVATION_FAIL' ? ev.message : '设备激活失败' }),
            effects: (_, ev) => [emit({ type: 'ConnectionError', message: ev.type === 'ACTIVATION_FAIL' ? ev.message : '设备激活失败' }), emitStatus('error')],
          },
          DISCONNECT: { target: 'idle', effects: () => [emit({ type: 'ActivationCleared' }), emit({ type: 'ConnectionReset' }), emitStatus('idle')] },
        },
      },

      wsConnecting: {
        entry: (ctx) => [
          emit({ type: 'WsInfoResolved', url: ctx.wsInfo?.url ?? '', token: ctx.wsInfo?.token ?? null }),
          emit({ type: 'Log', direction: 'system', data: `连接 WebSocket: ${ctx.wsInfo?.url ?? ''}` }),
          emitStatus('ws_connecting'),
          { kind: 'connectTransport' },
        ],
        on: {
          WS_OPEN: { target: 'handshaking' },
          ...activeGlobalOn,
        },
      },

      handshaking: {
        entry: (ctx) => [emitStatus('handshaking'), { kind: 'sendHello' }, { kind: 'startHandshakeTimer', ms: ctx.handshakeTimeoutMs }],
        on: {
          SERVER_HELLO: [
            {
              guard: (ctx) => ctx.mcpRequired,
              target: 'mcpInit',
              assign: (_, ev) => ev.type === 'SERVER_HELLO' ? { sessionId: ev.sessionId, sampleRate: ev.sampleRate } : {},
              effects: (ctx, ev) => [...helloEffects(ctx, ev), emitStatus('mcp_init')],
            },
            {
              target: 'ready',
              assign: (_, ev) => ev.type === 'SERVER_HELLO' ? { sessionId: ev.sessionId, sampleRate: ev.sampleRate } : {},
              effects: (ctx, ev) => [...helloEffects(ctx, ev), emitStatus('ready')],
            },
          ],
          HANDSHAKE_TIMEOUT: {
            target: 'error',
            assign: () => ({ errorMessage: '握手超时' }),
            effects: () => [emit({ type: 'ConnectionError', message: '握手超时' }), { kind: 'closeTransport' }, { kind: 'clearHandshakeTimer' }, emitStatus('error')],
          },
          ...activeGlobalOn,
        },
      },

      mcpInit: {
        on: {
          MCP_READY: { target: 'ready', effects: () => [emitStatus('ready')] },
          ...activeGlobalOn,
        },
      },

      ready: {
        // 收到 MCP notifications/initialized 等冗余 MCP_READY 时停留
        on: {
          MCP_READY: {},
          ...activeGlobalOn,
        },
      },

      error: {
        on: {
          CONNECT: { target: 'otaFetching', assign: () => ({ wsInfo: null, sessionId: null, errorMessage: null }) },
          DISCONNECT: { target: 'idle', effects: () => [emit({ type: 'ConnectionReset' }), emitStatus('idle')] },
          // 处于 error 后再来的 WS_CLOSE 不再重复重置（对齐原 teardown(resetConnection=false)）
          WS_CLOSE: {},
          WS_ERROR: {},
        },
      },
    },
  }
}
