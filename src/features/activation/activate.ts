// 设备激活轮询 —— 对齐 xiaozhi-esp32 固件 ota.cc 的 Activate() 流程。
//
// 说明：固件用 eFuse 序列号 + 硬件 HMAC_KEY0 计算 challenge 的 HMAC-SHA256 签名；
// Web 端无硬件密钥，按固件 has_serial_number_ == false 分支处理：
// GetActivationPayload() 返回 "{}"，仍 POST /activate 并按 200/202 轮询，不做真实签名。

/** 按固件逻辑拼接 /activate 端点 */
export function buildActivateUrl(otaUrl: string): string {
  return otaUrl.endsWith('/') ? `${otaUrl}activate` : `${otaUrl}/activate`
}

/** 发起一次激活请求，返回 HTTP 状态码（网络错误返回 0） */
export async function activateOnce(
  otaUrl: string,
  headers: Record<string, string>,
): Promise<number> {
  try {
    const res = await fetch(buildActivateUrl(otaUrl), {
      method: 'POST',
      headers,
      body: '{}', // 对应固件无序列号分支的 GetActivationPayload()
    })
    return res.status
  } catch {
    return 0
  }
}

const DEFAULT_INTERVAL_MS = 3000
const MAX_ATTEMPTS = 20

export interface RunActivationOptions {
  timeoutMs?: number
  signal?: () => boolean // 返回 true 时中止轮询（如连接已断开）
}

/**
 * 轮询激活，直到成功/失败/达到上限。
 * 对齐固件：200 → 成功，202 → 等待后重试，其它 → 失败。
 */
export async function runActivation(
  otaUrl: string,
  headers: Record<string, string>,
  opts: RunActivationOptions = {},
): Promise<boolean> {
  const interval = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_INTERVAL_MS
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.()) return false
    const status = await activateOnce(otaUrl, headers)
    if (status === 200) return true
    if (status !== 202 && status !== 0) return false // 明确的错误状态码 → 失败
    // 202（等待激活）或网络抖动（0）→ 等待后重试
    await new Promise(r => setTimeout(r, interval))
  }
  return false
}
