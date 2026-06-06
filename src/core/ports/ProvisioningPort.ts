// 设备配置/激活端口（HTTP 请求-响应，与实时双工通道本质不同，故独立成端口）。
// OTA 与激活在 WS / MQTT 两种通道下共用，是“无缝切换”的共享部分。

export interface OtaResult {
  websocket?: { url: string; token: string }
  activation?: { message: string; challenge?: string; timeout_ms?: number; [k: string]: unknown }
}

export interface RunActivationOptions {
  timeoutMs?: number
  isCancelled: () => boolean
}

export interface ProvisioningPort {
  fetchOta(otaUrl: string, deviceId: string, clientId: string): Promise<OtaResult>
  /** 轮询 /activate 直至成功/失败/超时。成功返回 true。 */
  runActivation(
    otaUrl: string, deviceId: string, clientId: string, opts: RunActivationOptions,
  ): Promise<boolean>
}
