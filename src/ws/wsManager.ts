import {
  isServerHello, isSTTMessage, isLLMMessage, isTTSMessage,
  isMCPMessage, isIoTCommand, isPongMessage, isAlertMessage,
  isServerResultMessage, EMOTION_MAP, buildPing, buildMCPResponse,
  type MCPMessage,
} from '../features/protocol/types'
import { initDecoder } from '../features/audio/opusDecoder'
import { TOOL_DEFINITIONS, handleToolCall } from '../features/mcp/tools'
import { useStore } from '../store'

let ws: WebSocket | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let handshakeTimer: ReturnType<typeof setTimeout> | null = null

function store() {
  return useStore.getState()
}

export async function connect(): Promise<void> {
  disconnect()

  const { config, deviceId, helloVersion, helloFeatures, helloAudio, handshakeTimeoutMs } = store()

  store().setStatus('ota_fetching')
  store().addLog('system', `OTA 请求: ${config.otaUrl}/xiaozhi/ota/`)

  let data: { websocket?: { url: string; token: string }; activation?: { message: string; [key: string]: unknown } }
  try {
    const res = await fetch(`${config.otaUrl}/xiaozhi/ota/`, {
      method: 'POST',
      headers: {
        'Device-Id': deviceId,
        'Client-Id': config.clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        application: { version: '1.0.0' },
        board: { type: 'open-xiaozhi-client' },
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    data = await res.json()
  } catch (e) {
    store().setError(`OTA 失败: ${(e as Error).message}`)
    return
  }

  // Check for activation requirement
  if (data.activation) {
    store().setActivation(data.activation)
    store().setStatus('activation_required')
    return
  }

  // Clear any previous activation prompt
  store().clearActivation()

  // Continue with normal WebSocket connection
  if (!data.websocket) {
    store().setError('OTA 响应缺少 websocket 字段')
    return
  }

  const wsUrl = data.websocket.url
  const token = data.websocket.token

  store().setWsInfo(wsUrl, token)
  store().setStatus('ws_connecting')

  const urlObj = new URL(wsUrl)
  urlObj.searchParams.set('device-id', deviceId)
  if (config.clientId) urlObj.searchParams.set('client-id', config.clientId)
  if (token) urlObj.searchParams.set('authorization', `Bearer ${token}`)
  store().addLog('system', `连接 WebSocket: ${urlObj.toString()}`)

  ws = new WebSocket(urlObj.toString())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    store().setStatus('handshaking')
    const hello = {
      type: 'hello',
      version: helloVersion,
      transport: 'websocket',
      features: helloFeatures,
      audio_params: helloAudio,
    }
    sendJson(hello)
    store().addLog('out', hello)

    handshakeTimer = setTimeout(() => {
      store().setError('握手超时')
      disconnect()
    }, handshakeTimeoutMs)
  }

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      handleBinary(new Uint8Array(event.data))
    } else {
      handleText(event.data as string)
    }
  }

  ws.onerror = () => {
    store().setError('WebSocket 连接错误')
  }

  ws.onclose = (ev) => {
    clearTimers()
    const s = store().status
    if (s !== 'error' && s !== 'idle') {
      store().addLog('system', `连接关闭: ${ev.code} ${ev.reason || '正常关闭'}`)
      store().reset()
    }
  }
}

function handleText(raw: string): void {
  let msg: unknown
  try {
    msg = JSON.parse(raw)
  } catch {
    store().addLog('in', raw)
    return
  }

  store().addLog('in', msg)

  if (isServerHello(msg)) {
    if (handshakeTimer !== null) {
      clearTimeout(handshakeTimer)
      handshakeTimer = null
    }
    store().setSessionId(msg.session_id)
    store().setDownstreamSampleRate(msg.audio_params.sample_rate)
    initDecoder(msg.audio_params.sample_rate)

    if (store().helloFeatures.mcp) {
      store().setStatus('mcp_init')
      // 等待服务端主动发起 initialize，不主动发送
    } else {
      store().setStatus('ready')
    }

    const iv = store().heartbeatIntervalMs
    if (iv > 0) {
      heartbeatTimer = setInterval(() => {
        const sid = store().sessionId
        if (sid) {
          const ping = buildPing(sid)
          sendJson(ping)
          store().addLog('out', ping)
        }
      }, iv)
    }
    return
  }

  if (isSTTMessage(msg)) {
    store().setSTT(msg.text)
    return
  }

  if (isLLMMessage(msg)) {
    store().setEmotion(msg.emotion, EMOTION_MAP[msg.emotion] ?? '😶')
    return
  }

  if (isTTSMessage(msg)) {
    if (msg.state === 'start') {
      store().setAudioStatus('playing')
    } else if (msg.state === 'sentence_start' && msg.text) {
      store().setTTSText(msg.text)
    } else if (msg.state === 'stop') {
      store().setAudioStatus('idle')
      store().setTTSText('')
    }
    return
  }

  if (isMCPMessage(msg)) {
    handleMcp(msg)
    return
  }

  if (isIoTCommand(msg)) {
    store().addReceivedCommand(msg)
    return
  }

  if (isPongMessage(msg)) {
    return
  }

  if (isAlertMessage(msg)) {
    store().setAlert(msg)
    return
  }

  if (isServerResultMessage(msg)) {
    store().addLog('system', `服务器响应: ${msg.status} – ${msg.message}`)
    return
  }
}

function handleMcp(msg: MCPMessage): void {
  const { payload } = msg
  const sid = store().sessionId ?? ''

  // initialize request from server (server is MCP initiator)
  if (payload.method === 'initialize') {
    const resp = buildMCPResponse(sid, {
      jsonrpc: '2.0',
      id: payload.id,
      result: { serverInfo: { name: 'open-xiaozhi-client', version: '0.1.0' } },
    })
    sendJson(resp)
    store().addLog('out', resp)
    return
  }

  // tools/list request from server
  if (payload.method === 'tools/list') {
    const resp = buildMCPResponse(sid, {
      jsonrpc: '2.0',
      id: payload.id,
      result: { tools: TOOL_DEFINITIONS },
    })
    sendJson(resp)
    store().addLog('out', resp)
    store().setStatus('ready')
    return
  }

  // tools/call request from server
  if (payload.method === 'tools/call') {
    const params = payload.params as { name: string; arguments?: Record<string, unknown> }
    const result = handleToolCall(params.name, params.arguments ?? {}, store().mockState)
    if (result.newState) store().updateMockState(result.newState)

    const responsePayload: MCPMessage['payload'] = { jsonrpc: '2.0', id: payload.id }
    if (result.isError) {
      responsePayload.error = { message: result.content[0].text }
    } else {
      responsePayload.result = { content: result.content }
    }
    const resp = buildMCPResponse(sid, responsePayload)
    sendJson(resp)
    store().addLog('out', resp)
    return
  }

  // notifications/initialized – server confirms MCP ready
  if (payload.method === 'notifications/initialized') {
    store().setStatus('ready')
    return
  }
}

function handleBinary(data: Uint8Array): void {
  store().addLog('binary-in', `[binary ${data.byteLength} bytes]`)
  window.dispatchEvent(new CustomEvent('ws:audio', { detail: data }))
}

export function sendJson(msg: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

export function sendBinary(data: Uint8Array): void {
  if (ws?.readyState === WebSocket.OPEN) {
    // TypeScript 6: Uint8Array<ArrayBufferLike> → narrow to ArrayBuffer slice
    ws.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  }
}

export function disconnect(): void {
  clearTimers()
  if (ws) {
    ws.onclose = null
    ws.onerror = null
    ws.close()
    ws = null
  }
}

function clearTimers(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (handshakeTimer !== null) {
    clearTimeout(handshakeTimer)
    handshakeTimer = null
  }
}
