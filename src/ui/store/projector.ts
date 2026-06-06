// 投影层：订阅领域事件总线，把事件单向写入 Zustand 只读视图模型。
// 这是 store 中“服务器派生状态”的唯一写入方（用户配置类写入仍由各面板触发）。

import { useStore } from '../../store'
import type { AppRuntime } from '../../application/AppRuntime'
import type { DomainEvent } from '../../core/events/domainEvents'
import type { ConnectionStatus } from '../../features/connection/connectionSlice'
import type { LogDirection } from '../../features/protocol/protocolSlice'
import type { AlertMessage } from '../../core/domain/protocol/messages'

export function attachProjector(runtime: AppRuntime): () => void {
  const s = () => useStore.getState()

  return runtime.subscribe((e: DomainEvent) => {
    switch (e.type) {
      // ── 连接 ──
      case 'ConnectionStatusChanged': s().setStatus(e.status as ConnectionStatus); break
      case 'ConnectionError': s().setError(e.message); break
      case 'SessionEstablished':
        s().setSessionId(e.sessionId)
        s().setDownstreamSampleRate(e.sampleRate)
        break
      case 'WsInfoResolved': s().setWsInfo(e.url, e.token ?? ''); break
      case 'OtaRequested': s().addLog('system', `OTA 请求: ${e.url}`); break
      case 'ActivationRequired': s().setActivation(e.payload); break
      case 'ActivationCleared': s().clearActivation(); break
      case 'ConnectionReset':
        s().finalizeAssistantMessage()
        s().resetAudio()
        s().clearVisionEndpoint()
        s().reset()
        break
      case 'VisionEndpoint': s().setVisionEndpoint(e.url, e.token); break
      case 'VisionCleared': s().clearVisionEndpoint(); break

      // ── 会话 / 轮次 ──
      case 'SttReceived':
        s().setSTT(e.text)
        s().commitUserMessage(e.text)
        if (e.internalTool) s().beginAssistantTurn()
        break
      case 'LlmEmotion': s().setEmotion(e.emotion, e.emoji); break
      case 'TtsStarted': s().beginAssistantTurn(); break
      case 'TtsSentence':
        s().setTTSText(e.text)
        s().appendAssistantText(e.text)
        break
      case 'TtsStopped':
        s().setTTSText('')
        s().finalizeAssistantMessage()
        break
      case 'AudioFrameReceived': s().appendAssistantAudio(e.frame); break
      case 'AudioFrameCaptured': s().appendPendingUserAudio(e.frame); break
      case 'AssistantTurnInterrupted': s().finalizeAssistantMessage(); break
      case 'TurnStateChanged':
        s().setAudioStatus(e.recording ? 'recording' : e.playing ? 'playing' : 'idle')
        s().setIsTTSActive(e.ttsActive)
        break
      case 'ListenModeChanged': s().setListenMode(e.mode); break
      case 'AudioError': s().setAudioError(e.message); break
      case 'AudioContextSuspended': s().setAudioContextSuspended(e.suspended); break

      // ── 耗时打点 ──
      case 'MarkUserStart': s().markUserStart(); break
      case 'MarkUserStop': s().markUserStop(); break
      case 'MarkStt': s().markStt(); break
      case 'MarkServerEnter': s().markServerEnter(); break
      case 'MarkServerSpeak': s().markServerSpeak(); break

      // ── 其它入站 ──
      case 'IotCommand': s().addReceivedCommand(e.cmd); break
      case 'Alert': s().setAlert(e.alert as AlertMessage); break
      case 'ServerResult': s().addLog('system', `服务器响应: ${e.status} – ${e.message}`); break

      // ── 协议日志 ──
      case 'Log': s().addLog(e.direction as LogDirection, e.data); break
      case 'BinaryLogged': s().addBinaryLog(e.direction, e.frame); break

      // ── 照片预览（当前由工具直接写 store，此事件保留以备） ──
      case 'PhotoCaptured': s().setCapturedPhoto(e.url); break
    }
  })
}
