import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { connect, disconnect } from '../wsManager'
import { useStore } from '../../store'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  binaryType = 'arraybuffer'
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null

  constructor(public url: string) {
    // Simulate async open
    setTimeout(() => {
      if (this.onopen) this.onopen()
    }, 0)
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
