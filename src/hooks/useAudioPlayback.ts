import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeChunksForPlayback } from '../features/audio/opusDecoder'
import { useStore } from '../store'

export function useAudioPlayback() {
  const downstreamSampleRate = useStore(s => s.downstreamSampleRate)
  const uploadSampleRate = useStore(s => s.helloAudio.sample_rate)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const [playingId, setPlayingId] = useState<string | number | null>(null)

  const stop = useCallback(() => {
    if (playbackCtxRef.current) {
      void playbackCtxRef.current.close()
      playbackCtxRef.current = null
      setPlayingId(null)
    }
  }, [])

  const play = useCallback((
    id: string | number,
    chunks: Uint8Array[],
    direction: 'in' | 'out',
  ) => {
    stop()
    if (playingId === id) return // toggle off
    if (!chunks.length) return

    const sampleRate = direction === 'in' ? downstreamSampleRate : uploadSampleRate
    try {
      const float32 = decodeChunksForPlayback(chunks, sampleRate)
      const ctx = new AudioContext({ sampleRate })
      playbackCtxRef.current = ctx

      const buffer = ctx.createBuffer(1, float32.length, sampleRate)
      buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
      setPlayingId(id)

      source.onended = () => {
        void ctx.close()
        playbackCtxRef.current = null
        setPlayingId(null)
      }
    } catch (e) {
      console.error('[useAudioPlayback] play error:', e)
      setPlayingId(null)
    }
  }, [downstreamSampleRate, uploadSampleRate, playingId, stop])

  useEffect(() => () => { stop() }, [stop])

  return { play, stop, playingId }
}
