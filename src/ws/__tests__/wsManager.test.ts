import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { connect, disconnect } from '../wsManager'
import { useStore } from '../../store'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  static instances: MockWebSocket[] = []
  readyState = MockWebSocket.OPEN
  binaryType = 'arraybuffer'
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    // Simulate async open
    setTimeout(() => {
      if (this.onopen) this.onopen()
    }, 0)
  }

  // Helper to simulate incoming text messages
  receive(data: unknown) {
    if (this.onmessage) this.onmessage({ data })
  }

  static get last(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }

  send = vi.fn()
  close = vi.fn()
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket

describe('wsManager OTA 激活分支', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    
    // Reset store to a clean state
    useStore.setState({
      status: 'idle',
      errorMessage: null,
      sessionId: null,
      wsUrl: null,
      token: null,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      config: {
        otaUrl: 'http://localhost:8003',
        clientId: 'test-client-id',
      },
    })
  })

  afterEach(() => {
    disconnect()
    vi.clearAllMocks()
  })

  it('OTA 响应包含 activation 时应该保存到 store 并设置状态为 activation_required', async () => {
    const activationPayload = {
      message: '设备需要激活，请联系管理员',
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ activation: activationPayload }),
    })

    await connect()

    // Should have called fetch
    expect(fetchMock).toHaveBeenCalledTimes(1)
    
    const state = useStore.getState()
    
    // Should save activation payload
    expect(state.activationPayload).toEqual(activationPayload)
    
    // Should set status to activation_required
    expect(state.status).toBe('activation_required')
    
    // Should NOT create WebSocket (no ws_connecting state)
    expect(state.wsUrl).toBe(null)
    expect(state.token).toBe(null)
  })

  it('OTA 响应不包含 activation 时应该清除激活状态并继续连接', async () => {
    // Pre-populate activation state
    useStore.getState().setActivation?.({ message: '旧的激活提示' })
    expect(useStore.getState().activationPayload).not.toBe(null)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        websocket: {
          url: 'ws://localhost:8080',
          token: 'test-token',
        },
      }),
    })

    await connect()

    // Wait for async WebSocket initialization
    await new Promise(resolve => setTimeout(resolve, 10))

    const state = useStore.getState()
    
    // Should clear activation payload
    expect(state.activationPayload).toBe(null)
    
    // Should proceed with WebSocket connection
    expect(state.wsUrl).toBe('ws://localhost:8080')
    expect(state.token).toBe('test-token')
    expect(state.status).toBe('handshaking')
  })

  it('OTA 响应包含 websocket 和 activation 时应该优先激活分支', async () => {
    const activationPayload = { message: '需要激活' }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        websocket: { url: 'ws://localhost:8080', token: 'token' },
        activation: activationPayload,
      }),
    })

    await connect()

    const state = useStore.getState()
    
    // Should save activation and stop before WebSocket
    expect(state.activationPayload).toEqual(activationPayload)
    expect(state.status).toBe('activation_required')
    expect(state.wsUrl).toBe(null)
  })

  it('OTA 失败时应该设置错误状态', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    await connect()

    const state = useStore.getState()
    expect(state.status).toBe('error')
    expect(state.errorMessage).toContain('OTA 失败')
  })
})

// ---------- Regression tests for TTS/LLM message ordering ----------

describe('wsManager tts/llm flows', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    useStore.setState({
      status: 'idle',
      errorMessage: null,
      sessionId: null,
      wsUrl: null,
      token: null,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      config: { otaUrl: 'http://localhost:8003', clientId: 'test-client-id' },
    })

    useStore.getState().clearConversation()
    MockWebSocket.instances = []
  })

  afterEach(() => {
    disconnect()
    vi.clearAllMocks()
    MockWebSocket.instances = []
  })

  it('music flow: tts.start must open assistant bubble and collect sentence_start texts', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    // Wait for ws initialization
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    // Send server hello
    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))

    // STT user message
    socket.receive(JSON.stringify({ type: 'stt', text: '% play_music', session_id: 's1' }))

    // TTS start - should open assistant bubble only after start
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))

    // Right after tts.start there should already be an assistant bubble (empty)
    const msgsAfterStart = useStore.getState().messages
    expect(msgsAfterStart.length).toBe(2)
    expect(msgsAfterStart[1].role).toBe('assistant')
    expect(msgsAfterStart[1].text).toBe('')

    // Two sentence_start fragments
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: 'Playing', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: 'song', session_id: 's1' }))

    // TTS stop - finalize assistant message
    socket.receive(JSON.stringify({ type: 'tts', state: 'stop', session_id: 's1' }))

    const msgs = useStore.getState().messages
    // New behavior: first user message, then a single assistant message with concatenated text
    expect(msgs.length).toBe(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].text).toBe('% play_music')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].text).toBe('Playing song')
  })

  it('guard: llm should NOT open assistant turn before tts.start arrives', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))
    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))

    // user STT
    socket.receive(JSON.stringify({ type: 'stt', text: '查询一下武汉天气', session_id: 's1' }))

    // LLM message arrives BEFORE any tts.start
    socket.receive(JSON.stringify({ type: 'llm', text: '天气晴朗', emotion: 'neutral', session_id: 's1' }))

    const msgs = useStore.getState().messages
    // New behavior: LLM alone should not create assistant message before tts.start
    expect(msgs.length).toBe(1)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].text).toBe('查询一下武汉天气')
  })

  it('mixed flow: tts.start -> llm -> tts.sentence_start should produce single assistant bubble', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))
    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))

    // user STT
    socket.receive(JSON.stringify({ type: 'stt', text: '播放歌曲', session_id: 's1' }))

    // TTS start comes first
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))

    // Right after tts.start there should already be an assistant bubble (empty)
    const msgsAfterTtsStart = useStore.getState().messages
    expect(msgsAfterTtsStart.length).toBe(2)
    expect(msgsAfterTtsStart[1].role).toBe('assistant')
    expect(msgsAfterTtsStart[1].text).toBe('')

    // LLM arrives after tts.start
    socket.receive(JSON.stringify({ type: 'llm', text: '好的，正在播放', emotion: 'neutral', session_id: 's1' }))

    // After llm arrives it must NOT create a duplicate assistant message
    const msgsAfterLlm = useStore.getState().messages
    expect(msgsAfterLlm.length).toBe(2)
    expect(msgsAfterLlm[1].role).toBe('assistant')

    // sentence_start fragments
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '好的，正在播放', session_id: 's1' }))

    // stop
    socket.receive(JSON.stringify({ type: 'tts', state: 'stop', session_id: 's1' }))

    const msgs = useStore.getState().messages
    // Expect only one assistant bubble created and appended to
    expect(msgs.length).toBe(2)
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].text).toBe('好的，正在播放')
  })

  it('disconnect finalizes an interrupted assistant turn before the next tts.start', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8081', token: 'token-2' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const firstSocket = (global.WebSocket as any).last as MockWebSocket
    expect(firstSocket).toBeDefined()

    firstSocket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    firstSocket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))
    firstSocket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '第一段', session_id: 's1' }))

    disconnect()

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const secondSocket = (global.WebSocket as any).last as MockWebSocket
    expect(secondSocket).toBeDefined()

    secondSocket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's2', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    secondSocket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's2' }))
    secondSocket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '第二段', session_id: 's2' }))
    secondSocket.receive(JSON.stringify({ type: 'tts', state: 'stop', session_id: 's2' }))

    const assistantMessages = useStore.getState().messages.filter(msg => msg.role === 'assistant')
    expect(assistantMessages).toHaveLength(2)
    expect(assistantMessages[0].text).toBe('第一段')
    expect(assistantMessages[0].audioFinalized).toBe(true)
    expect(assistantMessages[1].text).toBe('第二段')
    expect(assistantMessages[1].audioFinalized).toBe(true)
  })

  it('disconnect removes an empty assistant bubble opened by tts.start before any text or audio arrives', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    socket.receive(JSON.stringify({ type: 'stt', text: '新的用户问题', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))

    expect(useStore.getState().messages).toHaveLength(2)
    expect(useStore.getState().messages[1].role).toBe('assistant')
    expect(useStore.getState().messages[1].text).toBe('')

    disconnect()

    const messagesAfterDisconnect = useStore.getState().messages
    expect(messagesAfterDisconnect).toHaveLength(1)
    expect(messagesAfterDisconnect[0].role).toBe('user')
    expect(messagesAfterDisconnect[0].text).toBe('新的用户问题')
  })

  it('stt finalizes an open assistant turn before appending the next user message', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '上一段回复', session_id: 's1' }))

    socket.receive(JSON.stringify({ type: 'stt', text: '新的用户问题', session_id: 's1' }))

    const messagesAfterStt = useStore.getState().messages
    expect(messagesAfterStt).toHaveLength(2)
    expect(messagesAfterStt[0].role).toBe('assistant')
    expect(messagesAfterStt[0].text).toBe('上一段回复')
    expect(messagesAfterStt[0].audioFinalized).toBe(true)
    expect(messagesAfterStt[1].role).toBe('user')
    expect(messagesAfterStt[1].text).toBe('新的用户问题')

    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '新的回答', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'stop', session_id: 's1' }))

    const assistantMessages = useStore.getState().messages.filter(msg => msg.role === 'assistant')
    expect(assistantMessages).toHaveLength(2)
    expect(assistantMessages[1].text).toBe('新的回答')
    expect(assistantMessages[1].audioFinalized).toBe(true)
  })

  it('music tool stt should not prevent the following song reply bubble from appearing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    socket.receive(JSON.stringify({ type: 'stt', text: '播放音乐给我听', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'stt', text: '% play_music', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '正在为您播放', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '《中秋月》', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'listen', state: 'start', mode: 'auto', session_id: 's1' }))

    const messages = useStore.getState().messages
    expect(messages).toHaveLength(3)
    expect(messages[0].role).toBe('user')
    expect(messages[0].text).toBe('播放音乐给我听')
    expect(messages[1].role).toBe('user')
    expect(messages[1].text).toBe('% play_music')
    expect(messages[2].role).toBe('assistant')
    expect(messages[2].text).toBe('正在为您播放 《中秋月》')
  })

  it('tool stt mid-turn (assistant already spoke) must still show the post-tool reply', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    expect(socket).toBeDefined()

    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))
    // 真实日志顺序：用户说话 → 一个 tts.start → 助手先说几句 → 工具 STT + 工具调用 → 助手继续说 → tts.stop
    socket.receive(JSON.stringify({ type: 'stt', text: '不是你直接拍照看一下', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'start', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'llm', text: '🙂', emotion: 'happy', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '哦', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '明白了，二千', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '我会再次尝试拍照', session_id: 's1' }))
    // 工具调用（同一 TTS 会话中间，无第二个 tts.start）
    socket.receive(JSON.stringify({ type: 'stt', text: '% self_camera_take_photo', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'llm', text: '🙂', emotion: 'happy', session_id: 's1' }))
    // 工具调用之后的助手回复
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '请稍等一下', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '好的，我已经再次拍照了', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'sentence_start', text: '这次照片中的物品颜色比较清晰', session_id: 's1' }))
    socket.receive(JSON.stringify({ type: 'tts', state: 'stop', session_id: 's1' }))

    const messages = useStore.getState().messages
    expect(messages).toHaveLength(4)
    expect(messages[0].role).toBe('user')
    expect(messages[0].text).toBe('不是你直接拍照看一下')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].text).toBe('哦 明白了，二千 我会再次尝试拍照')
    expect(messages[2].role).toBe('user')
    expect(messages[2].text).toBe('% self_camera_take_photo')
    // 修复点：工具调用后的助手句子必须完整显示，而不是被丢弃
    expect(messages[3].role).toBe('assistant')
    expect(messages[3].text).toBe('请稍等一下 好的，我已经再次拍照了 这次照片中的物品颜色比较清晰')
  })
})

// ---------- MCP initialize: vision capability parsing ----------

describe('wsManager MCP vision capability', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    useStore.setState({
      status: 'idle',
      errorMessage: null,
      sessionId: null,
      wsUrl: null,
      token: null,
      deviceId: 'AA:BB:CC:DD:EE:FF',
      config: { otaUrl: 'http://localhost:8003', clientId: 'test-client-id' },
    })
    useStore.getState().clearVisionEndpoint()
    MockWebSocket.instances = []
  })

  afterEach(() => {
    disconnect()
    vi.clearAllMocks()
    MockWebSocket.instances = []
  })

  it('initialize 携带 capabilities.vision 时应写入 store 的 visionUrl/visionToken', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))

    socket.receive(JSON.stringify({
      type: 'mcp',
      session_id: 's1',
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          capabilities: {
            vision: { url: 'http://host:8003/mcp/vision/explain', token: 'eyJ-abc' },
          },
        },
      },
    }))

    const state = useStore.getState()
    expect(state.visionUrl).toBe('http://host:8003/mcp/vision/explain')
    expect(state.visionToken).toBe('eyJ-abc')
  })

  it('initialize 不含 vision 时不应设置端点', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ websocket: { url: 'ws://localhost:8080', token: 'token' } }) })

    await connect()
    await new Promise(r => setTimeout(r, 10))

    const socket = (global.WebSocket as any).last as MockWebSocket
    socket.receive(JSON.stringify({ type: 'hello', version: 1, transport: 'websocket', session_id: 's1', audio_params: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 20 } }))

    socket.receive(JSON.stringify({
      type: 'mcp',
      session_id: 's1',
      payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: {} } },
    }))

    expect(useStore.getState().visionUrl).toBe(null)
  })
})
