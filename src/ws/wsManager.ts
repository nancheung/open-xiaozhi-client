import {
  isServerHello, isSTTMessage, isLLMMessage, isTTSMessage,
  isMCPMessage, isIoTCommand, isPongMessage, isAlertMessage,
  isServerResultMessage, EMOTION_MAP, buildPing, buildMCPResponse, buildListen,
  type MCPMessage,
} from '../features/protocol/types'
import { initDecoder } from '../features/audio/opusDecoder'
import { buildOtaHeaders, buildSystemInfoBody } from '../features/connection/systemInfo'
import { runActivation } from '../features/activation/activate'
import { TOOL_DEFINITIONS, handleToolCall } from '../features/mcp/tools'
import { useStore } from '../store'

let ws: WebSocket | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let handshakeTimer: ReturnType<typeof setTimeout> | null = null
// 自动模式：TTS 开始时正在录音，则 TTS 结束后自动重启监听
let autoRestartListening = false

function store() {
  return useStore.getState()
}

function finalizeInterruptedAssistantTurn(): void {
  store().finalizeAssistantMessage()
}

function isInternalToolSTT(text: string): boolean {
  return text.trimStart().startsWith('%')
}

export async function connect(): Promise<void> {
  disconnect()

  const { config, deviceId, helloVersion, helloFeatures, helloAudio, handshakeTimeoutMs } = store()

  store().setStatus('ota_fetching')
  store().addLog('system', `OTA 请求: ${config.otaUrl}`)

  // 对齐 xiaozhi-esp32：请求头与系统信息体由 features/connection/systemInfo.ts 构造
  const otaHeaders = buildOtaHeaders(deviceId, config.clientId)
  const otaBody = JSON.stringify(buildSystemInfoBody(deviceId, config.clientId))

  let data: {
    websocket?: { url: string; token: string }
    activation?: { message: string; challenge?: string; timeout_ms?: number; [key: string]: unknown }
  }
  try {
    const res = await fetch(config.otaUrl, { method: 'POST', headers: otaHeaders, body: otaBody })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    data = await res.json()
  } catch (e) {
    store().setError(`OTA 失败: ${(e as Error).message}`)
    return
  }

  // 激活流程（对齐 xiaozhi-esp32 ota.cc Activate）
  if (data.activation) {
    store().setActivation(data.activation)
    store().setStatus('activation_required')

    // 携带 challenge → 走 /activate 轮询；否则保持「仅展示」行为
    if (typeof data.activation.challenge === 'string' && data.activation.challenge) {
      store().addLog('system', '设备激活中，正在轮询 /activate ...')
      const ok = await runActivation(config.otaUrl, otaHeaders, {
        timeoutMs: typeof data.activation.timeout_ms === 'number' ? data.activation.timeout_ms : undefined,
        signal: () => { const s = store().status; return s === 'idle' || s === 'error' },
      })
      if (!ok) {
        store().setError('设备激活失败')
        return
      }
      store().addLog('system', '设备激活成功')
      store().clearActivation()

      // 激活成功后若本次响应未带 websocket，则重新拉取 OTA 获取连接配置
      if (!data.websocket) {
        try {
          const res2 = await fetch(config.otaUrl, { method: 'POST', headers: otaHeaders, body: otaBody })
          if (!res2.ok) throw new Error(`HTTP ${res2.status} ${res2.statusText}`)
          data = await res2.json()
        } catch (e) {
          store().setError(`OTA 失败: ${(e as Error).message}`)
          return
        }
      }
    } else {
      return
    }
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
    ws = null
    const s = store().status
    const resetConnection = s !== 'error' && s !== 'idle'
    teardown({
      resetConnection,
      logMessage: resetConnection
        ? `连接关闭: ${ev.code} ${ev.reason || '正常关闭'}`
        : undefined,
    })
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
    // 内部工具 STT（% 前缀）出现在一个 TTS 会话中间：服务端不会再发第二个 tts.start，
    // 工具调用后的句子仍会以 sentence_start 继续下发。无论工具调用前的助手轮是否已说过话，
    // 都需要在追加 % 用户气泡后重开一个助手轮，否则后续句子会因最后一条是用户气泡而被丢弃。
    const shouldRestoreAssistantTurn = isInternalToolSTT(msg.text)
    store().setSTT(msg.text)
    store().commitUserMessage(msg.text)
    // 仅真实用户 STT 记入耗时分析；% 前缀的内部工具 STT 出现在 TTS 会话中间，跳过
    if (!shouldRestoreAssistantTurn) {
      store().markStt()
    }
    if (shouldRestoreAssistantTurn) {
      store().beginAssistantTurn()
    }
    return
  }

  if (isLLMMessage(msg)) {
    store().setEmotion(msg.emotion, EMOTION_MAP[msg.emotion] ?? '😶')
    return
  }

  if (isTTSMessage(msg)) {
    if (msg.state === 'start') {
      const listenMode = store().listenMode
      store().setIsTTSActive(true)
      store().markServerEnter()
      store().beginAssistantTurn()
      if (listenMode === 'realtime') {
        // 全双工：保持 audioStatus='recording'，麦克风持续采集发送
        autoRestartListening = false
      } else {
        // 半双工：停止录音；自动模式且当前正在录音时标记需要重启
        autoRestartListening = (listenMode === 'auto' && store().audioStatus === 'recording')
        store().setAudioStatus('playing')
      }
    } else if (msg.state === 'sentence_start' && msg.text) {
      store().markServerSpeak()
      store().setTTSText(msg.text)
      store().appendAssistantText(msg.text)
    } else if (msg.state === 'stop') {
      store().setIsTTSActive(false)
      store().setTTSText('')
      store().finalizeAssistantMessage()

      if (autoRestartListening) {
        autoRestartListening = false
        // 只有 audioStatus 仍为 'playing' 时才自动重启。
        // 若用户已点击麦克风（audioStatus='recording'）或中断按钮（audioStatus='idle'），
        // 说明用户已主动介入，保持当前状态不变。
        if (store().audioStatus === 'playing') {
          const sid = store().sessionId
          if (sid) {
            const restartMsg = buildListen('start', sid, { mode: 'auto' })
            sendJson(restartMsg)
            store().addLog('out', restartMsg)
            store().setAudioStatus('recording')
            store().markUserStart()
          } else {
            store().setAudioStatus('idle')
          }
        }
      } else if (store().listenMode === 'realtime') {
        // 实时模式：audioStatus 从未被改变，保持 'recording'，无缝进入下一轮
      } else {
        // 手动模式：若用户已打断并开始新录音（audioStatus='recording'），不干预
        if (store().audioStatus === 'playing') {
          store().setAudioStatus('idle')
        }
      }
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
    // 解析服务端下发的视觉能力端点（参考 ESP32 ParseCapabilities）
    const params = payload.params as
      { capabilities?: { vision?: { url?: unknown; token?: unknown } } } | undefined
    const vision = params?.capabilities?.vision
    if (vision && typeof vision.url === 'string') {
      const token = typeof vision.token === 'string' ? vision.token : null
      store().setVisionEndpoint(vision.url, token)
      store().addLog('system', `视觉端点已配置: ${vision.url}`)
    }

    const resp = buildMCPResponse(sid, {
      jsonrpc: '2.0',
      id: payload.id,
      result: { serverInfo: { name: 'open-xiaozhi-client', version: __APP_VERSION__ } },
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
    handleToolCall(params.name, params.arguments ?? {}).then(result => {
      const responsePayload: MCPMessage['payload'] = { jsonrpc: '2.0', id: payload.id }
      if (result.isError) {
        responsePayload.error = { message: result.content[0].text }
      } else {
        responsePayload.result = { content: result.content }
      }
      const resp = buildMCPResponse(sid, responsePayload)
      sendJson(resp)
      store().addLog('out', resp)
    })
    return
  }

  // notifications/initialized – server confirms MCP ready
  if (payload.method === 'notifications/initialized') {
    store().setStatus('ready')
    return
  }
}

function handleBinary(data: Uint8Array): void {
  store().markServerSpeak()
  store().addBinaryLog('binary-in', data)
  store().appendAssistantAudio(data)
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

interface TeardownOptions {
  resetConnection: boolean
  logMessage?: string
}

function teardown(opts: TeardownOptions): void {
  autoRestartListening = false
  clearTimers()
  finalizeInterruptedAssistantTurn()
  store().resetAudio()
  // vision 端点是连接级的，断开时清除；摄像头开关是独立的持久设备设置，不在此重置
  store().clearVisionEndpoint()
  if (opts.resetConnection) {
    if (opts.logMessage) store().addLog('system', opts.logMessage)
    store().reset()
  }
}

export function disconnect(): void {
  if (ws) {
    ws.onclose = null
    ws.onerror = null
    ws.close()
    ws = null
  }
  teardown({ resetConnection: true })
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
