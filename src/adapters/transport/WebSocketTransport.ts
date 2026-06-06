// WebSocket 传输适配器：实现 Transport 端口。
// 线缆专属细节（device-id/client-id/authorization 拼参、arraybuffer、裸 Opus）封装于此；
// 未来 MqttTransport 实现同一端口即可无缝替换。

import type { Transport, TransportConnectInfo, TransportListener } from '../../core/ports/Transport'

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null

  connect(info: TransportConnectInfo, listener: TransportListener): void {
    this.close()
    const urlObj = new URL(info.url)
    urlObj.searchParams.set('device-id', info.deviceId)
    if (info.clientId) urlObj.searchParams.set('client-id', info.clientId)
    if (info.token) urlObj.searchParams.set('authorization', `Bearer ${info.token}`)

    const ws = new WebSocket(urlObj.toString())
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => listener.onOpen()
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) listener.onBinary(new Uint8Array(event.data))
      else listener.onText(event.data as string)
    }
    ws.onerror = () => listener.onError('WebSocket 连接错误')
    ws.onclose = (ev) => {
      this.ws = null
      listener.onClose(ev.code, ev.reason)
    }
  }

  sendText(json: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(json)
  }

  sendBinary(frame: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // 窄化为 ArrayBuffer 切片（TS6：Uint8Array<ArrayBufferLike>）
      this.ws.send(frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer)
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.onopen = null
      try { this.ws.close() } catch { /* already closing */ }
      this.ws = null
    }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
