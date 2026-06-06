// 组合根（浏览器侧）：用真实浏览器适配器构建 AppRuntime，并接入投影层。
// 配置/标识/设置从 Zustand 读取（它们是用户输入，非服务器派生状态）。

import { EventBus } from '../../core/events/eventBus'
import type { DomainEvent } from '../../core/events/domainEvents'
import { AppRuntime } from '../../application/AppRuntime'
import { WebSocketTransport } from '../../adapters/transport/WebSocketTransport'
import { HttpProvisioning } from '../../adapters/provisioning/HttpProvisioning'
import { MicAudioInput } from '../../adapters/audio/MicAudioInput'
import { SpeakerAudioOutput } from '../../adapters/audio/SpeakerAudioOutput'
import { BrowserClock } from '../../adapters/clock/BrowserClock'
import { useStore } from '../../store'
import { applyVolume, applyBrightness, applyTheme } from '../../features/device/deviceSetters'
import { enableCamera, disableCamera } from '../../features/camera/cameraCapture'
import { attachProjector } from '../store/projector'

export interface AppServices {
  runtime: AppRuntime
  mic: MicAudioInput
  speaker: SpeakerAudioOutput
  dispose: () => void
}

export function createRuntime(): AppServices {
  const bus = new EventBus<DomainEvent>()
  const transport = new WebSocketTransport()
  const provisioning = new HttpProvisioning()
  const speaker = new SpeakerAudioOutput((e) => bus.emit(e))
  const mic = new MicAudioInput(
    () => useStore.getState().helloAudio.sample_rate,
    (msg) => bus.emit({ type: 'AudioError', message: msg }),
  )
  const clock = new BrowserClock()

  const runtime = new AppRuntime({
    transport, provisioning, audioInput: mic, audioOutput: speaker, clock, bus,
    getConnectConfig: () => {
      const st = useStore.getState()
      return {
        otaUrl: st.config.otaUrl,
        deviceId: st.deviceId,
        clientId: st.config.clientId,
        mcpRequired: st.helloFeatures.mcp,
        handshakeTimeoutMs: st.handshakeTimeoutMs,
        heartbeatIntervalMs: st.heartbeatIntervalMs,
      }
    },
    getHelloParams: () => {
      const st = useStore.getState()
      return { version: st.helloVersion, features: st.helloFeatures, audio: st.helloAudio }
    },
    initialMode: useStore.getState().listenMode,
    device: {
      setVolume: applyVolume,
      setBrightness: applyBrightness,
      setTheme: applyTheme,
      enableCamera: () => { void enableCamera() },
      disableCamera,
    },
  })

  const detach = attachProjector(runtime)
  return { runtime, mic, speaker, dispose: detach }
}
