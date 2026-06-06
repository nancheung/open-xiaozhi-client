import { describe, it, expect, vi } from 'vitest'
import { AppRuntime } from '../AppRuntime'
import type { Transport, TransportConnectInfo, TransportListener } from '../../core/ports/Transport'
import type { ProvisioningPort, OtaResult } from '../../core/ports/ProvisioningPort'
import type { AudioInputPort, AudioOutputPort } from '../../core/ports/AudioIoPort'
import type { ClockPort } from '../../core/ports/ClockPort'
import type { DomainEvent } from '../../core/events/domainEvents'

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

class FakeTransport implements Transport {
  listener: TransportListener | null = null
  sentText: unknown[] = []
  sentBinary: Uint8Array[] = []
  open = false
  connect(_info: TransportConnectInfo, listener: TransportListener) { this.listener = listener }
  sendText(json: string) { this.sentText.push(JSON.parse(json)) }
  sendBinary(frame: Uint8Array) { this.sentBinary.push(frame) }
  close() { this.open = false }
  get isOpen() { return this.open }
  // 模拟服务端
  fireOpen() { this.open = true; this.listener!.onOpen() }
  fireText(obj: unknown) { this.listener!.onText(JSON.stringify(obj)) }
  fireBinary(frame: Uint8Array) { this.listener!.onBinary(frame) }
  fireClose(code = 1000, reason = '') { this.listener!.onClose(code, reason) }
}

class FakeProvisioning implements ProvisioningPort {
  constructor(private ota: OtaResult, private activationOk = true) {}
  async fetchOta(): Promise<OtaResult> { return this.ota }
  async runActivation(): Promise<boolean> { return this.activationOk }
}

class FakeAudioInput implements AudioInputPort {
  started = false
  onFrame: ((f: Uint8Array) => void) | null = null
  async start(onFrame: (f: Uint8Array) => void) { this.started = true; this.onFrame = onFrame }
  stop() { this.started = false }
}

class FakeAudioOutput implements AudioOutputPort {
  configured: number | null = null
  played: Uint8Array[] = []
  configure(r: number) { this.configured = r }
  playFrame(f: Uint8Array) { this.played.push(f) }
  resume() {}
  reset() {}
}

const fakeClock: ClockPort = {
  now: () => 0,
  setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
}

function build(ota: OtaResult, opts: { mcp?: boolean; mode?: 'auto' | 'manual' | 'realtime'; activationOk?: boolean } = {}) {
  const transport = new FakeTransport()
  const provisioning = new FakeProvisioning(ota, opts.activationOk ?? true)
  const audioInput = new FakeAudioInput()
  const audioOutput = new FakeAudioOutput()
  const events: DomainEvent[] = []
  const runtime = new AppRuntime({
    transport, provisioning, audioInput, audioOutput, clock: fakeClock,
    getConnectConfig: () => ({
      otaUrl: 'http://ota', deviceId: 'dev', clientId: 'cli',
      mcpRequired: opts.mcp ?? false, handshakeTimeoutMs: 10000, heartbeatIntervalMs: 0,
    }),
    getHelloParams: () => ({ version: 3, features: { mcp: opts.mcp ?? false }, audio: { format: 'opus' } }),
    initialMode: opts.mode ?? 'manual',
    device: { setVolume: vi.fn(), setBrightness: vi.fn(), setTheme: vi.fn(), enableCamera: vi.fn(), disableCamera: vi.fn() },
  })
  runtime.subscribe((e) => events.push(e))
  const types = () => events.map(e => e.type)
  return { runtime, transport, audioInput, audioOutput, events, types }
}

const WS_OTA: OtaResult = { websocket: { url: 'ws://x', token: 't' } }
const helloMsg = { type: 'hello', session_id: 'sid-1', version: 1, transport: 'websocket', audio_params: { format: 'opus', sample_rate: 24000, channels: 1, frame_duration: 60 } }

describe('AppRuntime 集成（假端口驱动完整会话）', () => {
  it('连接 → 握手 → ready → 一轮对话（manual）', async () => {
    const { runtime, transport, audioOutput, types } = build(WS_OTA, { mode: 'manual' })

    runtime.dispatch({ type: 'Connect' })
    await flush()                       // OTA 异步完成
    expect(transport.listener).not.toBeNull()  // 已发起连接

    transport.fireOpen()
    // 已发送 hello
    expect(transport.sentText.some((m) => (m as { type: string }).type === 'hello')).toBe(true)

    transport.fireText(helloMsg)
    expect(runtime.connectionState).toBe('ready')   // 无 mcp → 直接 ready
    expect(audioOutput.configured).toBe(24000)
    expect(types()).toContain('SessionEstablished')
    expect(types()).toContain('ConnectionStatusChanged')

    // 用户开始说话
    runtime.dispatch({ type: 'ToggleMic' })
    expect(runtime.conversationState).toBe('listening')
    expect(transport.sentText.some((m) => (m as { type: string; state?: string }).type === 'listen' && (m as { state?: string }).state === 'start')).toBe(true)

    // 服务端：STT → TTS 流程
    transport.fireText({ type: 'stt', text: '今天天气', session_id: 'sid-1' })
    transport.fireText({ type: 'tts', state: 'start', session_id: 'sid-1' })
    expect(runtime.conversationState).toBe('speaking')
    transport.fireText({ type: 'tts', state: 'sentence_start', text: '今天晴', session_id: 'sid-1' })
    transport.fireBinary(new Uint8Array([1, 2, 3]))
    expect(audioOutput.played).toHaveLength(1)        // 下行音频已播放
    transport.fireText({ type: 'tts', state: 'stop', session_id: 'sid-1' })
    expect(runtime.conversationState).toBe('idle')    // manual：回 idle

    const t = types()
    expect(t).toEqual(expect.arrayContaining(['SttReceived', 'TtsStarted', 'TtsSentence', 'AudioFrameReceived', 'TtsStopped', 'MarkServerSpeak', 'MarkStt']))
  })

  it('mcp 必需时握手后进入 mcpInit，tools/list 应答后 ready', async () => {
    const { runtime, transport } = build(WS_OTA, { mcp: true })
    runtime.dispatch({ type: 'Connect' })
    await flush()
    transport.fireOpen()
    transport.fireText(helloMsg)
    expect(runtime.connectionState).toBe('mcpInit')
    transport.fireText({ type: 'mcp', payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' } })
    expect(runtime.connectionState).toBe('ready')
    // 已回应 tools
    expect(transport.sentText.some((m) => (m as { type: string }).type === 'mcp')).toBe(true)
  })

  it('激活流程：含 challenge → 轮询成功 → 连接', async () => {
    const ota: OtaResult = { activation: { message: '请激活', challenge: 'c' }, websocket: { url: 'ws://x', token: '' } }
    const { runtime, transport, types } = build(ota, { activationOk: true })
    runtime.dispatch({ type: 'Connect' })
    await flush()  // fetchOta
    await flush()  // runActivation
    await flush()
    expect(types()).toContain('ActivationRequired')
    expect(transport.listener).not.toBeNull()  // 激活后已发起连接
  })

  it('断开：发 ConnectionReset 并使会话机回 idle', async () => {
    const { runtime, transport } = build(WS_OTA, { mode: 'manual' })
    runtime.dispatch({ type: 'Connect' })
    await flush()
    transport.fireOpen()
    transport.fireText(helloMsg)
    runtime.dispatch({ type: 'ToggleMic' })
    expect(runtime.conversationState).toBe('listening')
    runtime.dispatch({ type: 'Disconnect' })
    expect(runtime.connectionState).toBe('idle')
    expect(runtime.conversationState).toBe('idle')
  })

  it('realtime 全双工：TTS 期间保持录音，结束回 listening', async () => {
    const { runtime, transport } = build(WS_OTA, { mode: 'realtime' })
    runtime.dispatch({ type: 'Connect' })
    await flush()
    transport.fireOpen()
    transport.fireText(helloMsg)
    runtime.dispatch({ type: 'ToggleMic' })
    transport.fireText({ type: 'tts', state: 'start', session_id: 'sid-1' })
    expect(runtime.conversationState).toBe('fullDuplex')
    transport.fireText({ type: 'tts', state: 'stop', session_id: 'sid-1' })
    expect(runtime.conversationState).toBe('listening')
  })
})
