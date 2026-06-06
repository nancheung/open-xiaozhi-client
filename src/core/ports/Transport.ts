// 实时双工通道端口。WebSocket 是其当前唯一适配器；未来 MQTT 适配器可无缝替换：
// MQTT 只需在 sendBinary 前加 16 字节音频头、在 onBinary 中去头，系统其余部分无感知。

export interface TransportConnectInfo {
  url: string
  token: string | null
  deviceId: string
  clientId: string
}

/** 传输适配器向上抛出的入站事件，已与具体线缆格式解耦。 */
export interface TransportListener {
  onOpen(): void
  onText(raw: string): void            // 已是 UTF-8 JSON 字符串
  onBinary(frame: Uint8Array): void    // 裸 Opus 帧（适配器已剥离任何传输头）
  onError(message: string): void
  onClose(code: number, reason: string): void
}

export interface Transport {
  connect(info: TransportConnectInfo, listener: TransportListener): void
  sendText(json: string): void
  sendBinary(frame: Uint8Array): void  // 适配器按需添加传输专属头
  close(): void
  readonly isOpen: boolean
}
