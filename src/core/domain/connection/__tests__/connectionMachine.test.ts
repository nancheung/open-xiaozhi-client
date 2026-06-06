import { describe, it, expect } from 'vitest'
import { MachineRunner } from '../../../fsm/defineMachine'
import { createConnectionMachine } from '../connectionMachine'
import type { ConnEffect, ConnEvent } from '../connectionTypes'
import type { OtaResult } from '../../../ports/ProvisioningPort'

function runner(over: Partial<Parameters<typeof createConnectionMachine>[0]> = {}) {
  const cfg = {
    otaUrl: 'http://ota', deviceId: 'dev', clientId: 'cli',
    mcpRequired: true, handshakeTimeoutMs: 10000, heartbeatIntervalMs: 0, ...over,
  }
  const fx: ConnEffect[] = []
  const r = new MachineRunner(createConnectionMachine(cfg), (f) => fx.push(f))
  const send = (e: ConnEvent) => { fx.length = 0; r.send(e) }
  const connect = () => send({ type: 'CONNECT', config: cfg })
  return { r, fx, send, connect }
}

const kinds = (fx: ConnEffect[]) => fx.map(f => f.kind === 'emit' ? `emit:${f.event.type}` : f.kind)

describe('connectionMachine', () => {
  it('idle--CONNECT-->otaFetching 触发 fetchOta', () => {
    const { r, fx, connect } = runner()
    connect()
    expect(r.state).toBe('otaFetching')
    expect(kinds(fx)).toContain('fetchOta')
  })

  it('OTA_OK 含 websocket -> wsConnecting 并 connectTransport', () => {
    const { r, send, fx, connect } = runner()
    connect()
    const result: OtaResult = { websocket: { url: 'ws://x', token: 't' } }
    send({ type: 'OTA_OK', result })
    expect(r.state).toBe('wsConnecting')
    expect(r.context.wsInfo).toEqual({ url: 'ws://x', token: 't', deviceId: 'dev', clientId: 'cli' })
    expect(kinds(fx)).toContain('connectTransport')
  })

  it('OTA_OK 含 challenge 激活 -> activating 并 runActivation', () => {
    const { r, send, fx, connect } = runner()
    connect()
    send({ type: 'OTA_OK', result: { activation: { message: 'm', challenge: 'c', timeout_ms: 5000 } } })
    expect(r.state).toBe('activating')
    expect(r.context.activationTimeoutMs).toBe(5000)
    expect(kinds(fx)).toContain('runActivation')
  })

  it('OTA_OK 仅展示激活（无 challenge）-> activationRequired，不连接', () => {
    const { r, send, connect } = runner()
    connect()
    send({ type: 'OTA_OK', result: { activation: { message: '请激活' } } })
    expect(r.state).toBe('activationRequired')
  })

  it('ACTIVATION_OK 带 websocket -> wsConnecting', () => {
    const { r, send, connect } = runner()
    connect()
    send({ type: 'OTA_OK', result: { activation: { message: 'm', challenge: 'c' } } })
    send({ type: 'ACTIVATION_OK', result: { websocket: { url: 'ws://y', token: '' } } })
    expect(r.state).toBe('wsConnecting')
    expect(r.context.wsInfo?.token).toBeNull()
  })

  it('握手成功(mcp 必需) -> mcpInit，含 initDecoder/SessionEstablished', () => {
    const { r, send, fx, connect } = runner({ mcpRequired: true, heartbeatIntervalMs: 3000 })
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    expect(r.state).toBe('handshaking')
    send({ type: 'SERVER_HELLO', sessionId: 'sid', sampleRate: 24000 })
    expect(r.state).toBe('mcpInit')
    const k = kinds(fx)
    expect(k).toContain('initDecoder')
    expect(k).toContain('clearHandshakeTimer')
    expect(k).toContain('startHeartbeat')
    expect(k).toContain('emit:SessionEstablished')
    send({ type: 'MCP_READY' })
    expect(r.state).toBe('ready')
  })

  it('握手成功(无 mcp) 直接 ready', () => {
    const { r, send, connect } = runner({ mcpRequired: false })
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    send({ type: 'SERVER_HELLO', sessionId: 'sid', sampleRate: 16000 })
    expect(r.state).toBe('ready')
  })

  it('握手超时 -> error', () => {
    const { r, send, connect } = runner()
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    send({ type: 'HANDSHAKE_TIMEOUT' })
    expect(r.state).toBe('error')
  })

  it('活跃态 WS_CLOSE -> idle 并发 ConnectionReset；error 后再 WS_CLOSE 不重复重置', () => {
    const { r, send, fx, connect } = runner({ mcpRequired: false })
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    send({ type: 'SERVER_HELLO', sessionId: 'sid', sampleRate: 16000 })
    send({ type: 'WS_CLOSE', code: 1000, reason: 'bye' })
    expect(r.state).toBe('idle')
    expect(kinds(fx)).toContain('emit:ConnectionReset')

    // 进入 error 后再来的 WS_CLOSE 应被忽略（不再发 ConnectionReset）
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    send({ type: 'WS_ERROR', message: 'boom' })
    expect(r.state).toBe('error')
    send({ type: 'WS_CLOSE', code: 1006, reason: '' })
    expect(r.state).toBe('error')
    expect(kinds(fx)).not.toContain('emit:ConnectionReset')
  })

  it('DISCONNECT 从 ready -> idle 并 teardown', () => {
    const { r, send, fx, connect } = runner({ mcpRequired: false })
    connect()
    send({ type: 'OTA_OK', result: { websocket: { url: 'ws://x', token: '' } } })
    send({ type: 'WS_OPEN' })
    send({ type: 'SERVER_HELLO', sessionId: 'sid', sampleRate: 16000 })
    send({ type: 'DISCONNECT' })
    expect(r.state).toBe('idle')
    const k = kinds(fx)
    expect(k).toContain('closeTransport')
    expect(k).toContain('stopHeartbeat')
    expect(k).toContain('emit:ConnectionReset')
    expect(k).toContain('emit:VisionCleared')
  })
})
