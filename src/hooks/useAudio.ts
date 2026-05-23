import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { encodeFloat32ToOpus, disposeEncoder } from '../features/audio/opusEncoder'
import { decodeOpusToFloat32 } from '../features/audio/opusDecoder'
import { createRecordingProcessorUrl } from '../features/audio/recordingProcessor'
import { sendBinary } from '../ws/wsManager'
import { registerGainNode } from '../features/mcp/audioControl'

export function useAudio() {
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const playbackMasterGainRef = useRef<GainNode | null>(null)
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null)

  const recordCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null)

  const nextPlayTimeRef = useRef(0)

  const downstreamSampleRate = useStore(s => s.downstreamSampleRate)
  const uploadSampleRate = useStore(s => s.helloAudio.sample_rate)
  const audioStatus = useStore(s => s.audioStatus)

  function getPlaybackCtx() {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const ctx = new AudioContext({ sampleRate: downstreamSampleRate })

      // 主混音节点 → 分析节点 → 扬声器
      const masterGain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      masterGain.connect(analyser)
      analyser.connect(ctx.destination)

      playbackCtxRef.current = ctx
      playbackMasterGainRef.current = masterGain
      playbackAnalyserRef.current = analyser
      registerGainNode(masterGain)
      nextPlayTimeRef.current = 0

      const onStateChange = () => {
        useStore.getState().setAudioContextSuspended(ctx.state === 'suspended')
      }
      ctx.addEventListener('statechange', onStateChange)
    }
    return playbackCtxRef.current
  }

  // 接收服务器音频并播放
  useEffect(() => {
    const handleAudio = (event: Event) => {
      try {
        const data = (event as CustomEvent<Uint8Array>).detail
        const ctx = getPlaybackCtx()
        const float32 = decodeOpusToFloat32(data)
        const buffer = ctx.createBuffer(1, float32.length, downstreamSampleRate)
        // TypeScript 6: Float32Array<ArrayBufferLike> → narrow to ArrayBuffer
        buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0)

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(playbackMasterGainRef.current!)

        const now = ctx.currentTime
        const startAt = Math.max(now, nextPlayTimeRef.current)
        source.start(startAt)
        nextPlayTimeRef.current = startAt + buffer.duration
      } catch (e) {
        console.error('[useAudio] playback error:', e)
      }
    }

    window.addEventListener('ws:audio', handleAudio)
    return () => window.removeEventListener('ws:audio', handleAudio)
  }, [downstreamSampleRate])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: uploadSampleRate, channelCount: 1, echoCancellation: true },
      })
      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: uploadSampleRate })
      recordCtxRef.current = ctx

      // 加载 AudioWorklet Processor（Blob URL，兼容 dev/preview/build）
      const processorUrl = createRecordingProcessorUrl()
      await ctx.audioWorklet.addModule(processorUrl)
      URL.revokeObjectURL(processorUrl)

      const source = ctx.createMediaStreamSource(stream)

      // 录音音量分析（供 VolumeBar 使用）
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      recordingAnalyserRef.current = analyser

      const worklet = new AudioWorkletNode(ctx, 'recording-processor')
      worklet.port.onmessage = (e: MessageEvent<{ type: string; data: Float32Array }>) => {
        if (e.data.type === 'pcm') {
          const encoded = encodeFloat32ToOpus(e.data.data)
          sendBinary(encoded)
          useStore.getState().addBinaryLog('binary-out', encoded)
          useStore.getState().appendPendingUserAudio(encoded)
        }
      }

      source.connect(analyser)
      source.connect(worklet)
      worklet.connect(ctx.destination)
      workletRef.current = worklet
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问'
          : `录音初始化失败: ${(e as Error).message}`
      useStore.getState().setAudioError(msg)
      useStore.getState().setAudioStatus('idle')
    }
  }

  function stopRecording() {
    workletRef.current?.disconnect()
    workletRef.current = null
    recordingAnalyserRef.current = null
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaStreamRef.current = null
    void recordCtxRef.current?.close()
    recordCtxRef.current = null
    disposeEncoder()
  }

  useEffect(() => {
    if (audioStatus === 'recording') {
      void startRecording()
    } else {
      stopRecording()
    }
  }, [audioStatus])

  useEffect(() => {
    return () => {
      stopRecording()
      void playbackCtxRef.current?.close()
      playbackCtxRef.current = null
      playbackMasterGainRef.current = null
      playbackAnalyserRef.current = null
      registerGainNode(null)
    }
  }, [])

  function resumeAudioContext() {
    void playbackCtxRef.current?.resume()
  }

  return { recordingAnalyserRef, playbackAnalyserRef, resumeAudioContext }
}
