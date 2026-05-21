import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { encodeFloat32ToOpus, disposeEncoder } from '../features/audio/opusEncoder'
import { decodeOpusToFloat32 } from '../features/audio/opusDecoder'
import { sendBinary } from '../ws/wsManager'

export function useAudio() {
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const recordCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const nextPlayTimeRef = useRef(0)

  const downstreamSampleRate = useStore(s => s.downstreamSampleRate)
  const uploadSampleRate = useStore(s => s.helloAudio.sample_rate)
  const audioStatus = useStore(s => s.audioStatus)

  function getPlaybackCtx() {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: downstreamSampleRate })
      nextPlayTimeRef.current = 0
    }
    return playbackCtxRef.current
  }

  // Incoming audio playback
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
        source.connect(ctx.destination)

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
      const source = ctx.createMediaStreamSource(stream)
      // 960 samples = 60 ms at 16 kHz (matches helloAudio.frame_duration)
      const processor = ctx.createScriptProcessor(960, 1, 1)

      processor.onaudioprocess = (e) => {
        const input = new Float32Array(e.inputBuffer.getChannelData(0))
        const encoded = encodeFloat32ToOpus(input)
        sendBinary(encoded)
        useStore.getState().addLog('binary-out', `[binary ${encoded.byteLength} bytes]`)
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      processorRef.current = processor
    } catch (e) {
      console.error('[useAudio] startRecording error:', e)
    }
  }

  function stopRecording() {
    processorRef.current?.disconnect()
    processorRef.current = null
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
    }
  }, [])
}
