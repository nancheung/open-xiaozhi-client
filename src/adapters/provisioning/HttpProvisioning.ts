// OTA / 激活的 HTTP 适配器：实现 ProvisioningPort。
// 复用既有的对齐 xiaozhi-esp32 固件的纯函数（systemInfo / activate）。

import type {
  OtaResult, ProvisioningPort, RunActivationOptions,
} from '../../core/ports/ProvisioningPort'
import { buildOtaHeaders, buildSystemInfoBody } from '../../features/connection/systemInfo'
import { runActivation } from '../../features/activation/activate'

export class HttpProvisioning implements ProvisioningPort {
  async fetchOta(otaUrl: string, deviceId: string, clientId: string): Promise<OtaResult> {
    const headers = buildOtaHeaders(deviceId, clientId)
    const body = JSON.stringify(buildSystemInfoBody(deviceId, clientId))
    const res = await fetch(otaUrl, { method: 'POST', headers, body })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return await res.json() as OtaResult
  }

  async runActivation(
    otaUrl: string, deviceId: string, clientId: string, opts: RunActivationOptions,
  ): Promise<boolean> {
    const headers = buildOtaHeaders(deviceId, clientId)
    return runActivation(otaUrl, headers, { timeoutMs: opts.timeoutMs, signal: opts.isCancelled })
  }
}
