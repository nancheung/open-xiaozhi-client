// 扬声器播放适配器：实现 AudioOutputPort，并拥有主增益节点（音量控制源）。
// 取代原 useAudio 的播放半部与全局 audioControl 单例。

import type { AudioOutputPort } from '../../core/ports/AudioIoPort'
import type { DomainEvent } from '../../core/events/domainEvents'
import { decodeOpusToFloat32, initDecoder } from '../../features/audio/opusDecoder'
import { registerGainNode } from '../../features/mcp/audioControl'

/** 主音量控制接口（供设备控制适配器调节扬声器音量）。 */
export interface MasterVolume {
  setMasterVolume(value: number): void  // 0-100
  getMasterVolume(): number
}

type AnalyserListener = (node: AnalyserNode | null) => void

export class SpeakerAudioOutput implements AudioOutputPort, MasterVolume {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private nextPlayTime = 0
  private sampleRate = 24000
  private pendingVolume = 100
  private readonly analyserListeners = new Set<AnalyserListener>()

  constructor(private readonly emit: (e: DomainEvent) => void) {}

  configure(sampleRate: number): void {
    initDecoder(sampleRate)
    if (this.ctx && this.sampleRate !== sampleRate) this.reset()
    this.sampleRate = sampleRate
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const ctx = new AudioContext({ sampleRate: this.sampleRate })
      const masterGain = ctx.createGain()
      masterGain.gain.value = this.pendingVolume / 100
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      masterGain.connect(analyser)
      analyser.connect(ctx.destination)
      this.ctx = ctx
      this.masterGain = masterGain
      this.analyser = analyser
      this.nextPlayTime = 0
      // 注册到全局增益登记处，使 deviceSetters/MCP 工具的音量控制继续生效
      registerGainNode(masterGain)
      this.notifyAnalyser()
      ctx.addEventListener('statechange', () => {
        this.emit({ type: 'AudioContextSuspended', suspended: ctx.state === 'suspended' })
      })
    }
    return this.ctx
  }

  playFrame(frame: Uint8Array): void {
    try {
      const ctx = this.ensureCtx()
      const float32 = decodeOpusToFloat32(frame)
      const buffer = ctx.createBuffer(1, float32.length, this.sampleRate)
      buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(this.masterGain!)
      const startAt = Math.max(ctx.currentTime, this.nextPlayTime)
      source.start(startAt)
      this.nextPlayTime = startAt + buffer.duration
    } catch (e) {
      console.error('[SpeakerAudioOutput] playback error:', e)
    }
  }

  resume(): void { void this.ctx?.resume() }

  reset(): void {
    void this.ctx?.close()
    this.ctx = null
    this.masterGain = null
    this.analyser = null
    this.nextPlayTime = 0
    registerGainNode(null)
    this.notifyAnalyser()
  }

  // ── MasterVolume ──
  setMasterVolume(value: number): void {
    this.pendingVolume = value
    if (this.masterGain) this.masterGain.gain.value = value / 100
  }

  getMasterVolume(): number {
    return this.masterGain ? Math.round(this.masterGain.gain.value * 100) : this.pendingVolume
  }

  // ── 可视化（浏览器专属，超出端口范围，供 UI hook 使用） ──
  getAnalyser(): AnalyserNode | null { return this.analyser }
  onAnalyserChange(cb: AnalyserListener): () => void {
    this.analyserListeners.add(cb)
    return () => { this.analyserListeners.delete(cb) }
  }
  private notifyAnalyser(): void { for (const cb of this.analyserListeners) cb(this.analyser) }
}
