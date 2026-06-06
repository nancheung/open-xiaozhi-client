// 麦克风采集适配器：实现 AudioInputPort。取代原 useAudio 的录音半部。
// 通过录音会话代号取消仍在 await 中的启动流程（连接关闭/用户停止时避免重新接好麦克风）。

import type { AudioInputPort } from '../../core/ports/AudioIoPort'
import { encodeFloat32ToOpus, disposeEncoder } from '../../features/audio/opusEncoder'
import { createRecordingProcessorUrl } from '../../features/audio/recordingProcessor'

type AnalyserListener = (node: AnalyserNode | null) => void

export class MicAudioInput implements AudioInputPort {
  private ctx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private worklet: AudioWorkletNode | null = null
  private analyser: AnalyserNode | null = null
  private session = 0
  private readonly analyserListeners = new Set<AnalyserListener>()

  constructor(
    private readonly getUploadSampleRate: () => number,
    private readonly onError: (message: string) => void,
  ) {}

  async start(onFrame: (frame: Uint8Array) => void): Promise<void> {
    const session = ++this.session
    const sampleRate = this.getUploadSampleRate()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate, channelCount: 1, echoCancellation: true },
      })
      if (session !== this.session) { stream.getTracks().forEach(t => t.stop()); return }
      this.mediaStream = stream

      const ctx = new AudioContext({ sampleRate })
      this.ctx = ctx
      const processorUrl = createRecordingProcessorUrl()
      await ctx.audioWorklet.addModule(processorUrl)
      URL.revokeObjectURL(processorUrl)

      if (session !== this.session) {
        stream.getTracks().forEach(t => t.stop())
        void ctx.close()
        this.mediaStream = null
        this.ctx = null
        return
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      this.analyser = analyser

      const worklet = new AudioWorkletNode(ctx, 'recording-processor')
      worklet.port.onmessage = (e: MessageEvent<{ type: string; data: Float32Array }>) => {
        if (e.data.type === 'pcm') onFrame(encodeFloat32ToOpus(e.data.data))
      }

      source.connect(analyser)
      source.connect(worklet)
      worklet.connect(ctx.destination)
      this.worklet = worklet
      this.notifyAnalyser()
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问'
        : `录音初始化失败: ${(e as Error).message}`
      this.onError(msg)
      throw e
    }
  }

  stop(): void {
    this.session++
    this.worklet?.disconnect()
    this.worklet = null
    this.analyser = null
    this.notifyAnalyser()
    this.mediaStream?.getTracks().forEach(t => t.stop())
    this.mediaStream = null
    void this.ctx?.close()
    this.ctx = null
    disposeEncoder()
  }

  getAnalyser(): AnalyserNode | null { return this.analyser }
  onAnalyserChange(cb: AnalyserListener): () => void {
    this.analyserListeners.add(cb)
    return () => { this.analyserListeners.delete(cb) }
  }
  private notifyAnalyser(): void { for (const cb of this.analyserListeners) cb(this.analyser) }
}
