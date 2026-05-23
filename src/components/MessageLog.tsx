import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useStore } from '../store'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import type { LogEntry, LogDirection } from '../features/protocol/protocolSlice'
import { decodeChunksForPlayback } from '../features/audio/opusDecoder'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const DIR_LABEL: Record<LogDirection, string> = {
  in: '↓ IN', out: '↑ OUT', 'binary-in': '↓ BIN', 'binary-out': '↑ BIN', system: '● SYS',
}

const DIR_CLASS: Record<LogDirection, string> = {
  in: 'text-blue-500 dark:text-blue-400',
  out: 'text-green-600 dark:text-green-400',
  'binary-in': 'text-purple-500 dark:text-purple-400',
  'binary-out': 'text-orange-500 dark:text-orange-400',
  system: 'text-muted-foreground',
}

function LogRow({ entry, onPlay, playingId }: {
  entry: LogEntry
  onPlay?: (entry: LogEntry) => void
  playingId?: number | null
}) {
  const { direction, timestamp, data } = entry
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  const canPlay = (direction === 'binary-in' || direction === 'binary-out') && !!entry.audioChunks?.length
  const isPlaying = playingId === entry.id

  return (
    <div className="flex gap-2 py-0.5 border-b border-border/20 text-[11px] font-mono hover:bg-muted/20 items-center">
      <span className="text-muted-foreground/60 w-[72px] shrink-0 tabular-nums">{formatTime(timestamp)}</span>
      <span className={`w-14 shrink-0 font-semibold ${DIR_CLASS[direction]}`}>{DIR_LABEL[direction]}</span>
      <span className="break-all text-foreground/80 min-w-0 flex-1">{text}</span>
      {canPlay && onPlay && (
        <button
          className={`shrink-0 ml-1 p-0.5 rounded transition-colors ${isPlaying ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground/50 hover:text-foreground'}`}
          onClick={() => onPlay(entry)}
          title={isPlaying ? '停止' : '播放音频'}
        >
          {isPlaying ? <Square size={10} /> : <Play size={10} />}
        </button>
      )}
    </div>
  )
}

export function MessageLog() {
  const log = useStore(s => s.log)
  const clearLog = useStore(s => s.clearLog)
  const downstreamSampleRate = useStore(s => s.downstreamSampleRate)
  const uploadSampleRate = useStore(s => s.helloAudio.sample_rate)
  const bottomRef = useRef<HTMLDivElement>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  const handlePlay = useCallback((entry: LogEntry) => {
    // stop current playback
    if (playbackCtxRef.current) {
      void playbackCtxRef.current.close()
      playbackCtxRef.current = null
      setPlayingId(null)
      if (playingId === entry.id) return
    }

    if (!entry.audioChunks?.length) return
    const sampleRate = entry.direction === 'binary-in' ? downstreamSampleRate : uploadSampleRate

    try {
      const float32 = decodeChunksForPlayback(entry.audioChunks, sampleRate)
      const ctx = new AudioContext({ sampleRate })
      playbackCtxRef.current = ctx

      const buffer = ctx.createBuffer(1, float32.length, sampleRate)
      buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
      setPlayingId(entry.id)

      source.onended = () => {
        void ctx.close()
        playbackCtxRef.current = null
        setPlayingId(null)
      }
    } catch (e) {
      console.error('[MessageLog] play error:', e)
      setPlayingId(null)
    }
  }, [downstreamSampleRate, uploadSampleRate, playingId])

  // cleanup on unmount
  useEffect(() => {
    return () => { void playbackCtxRef.current?.close() }
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          协议日志 <span className="tabular-nums">({log.length})</span>
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearLog}>
          清空
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-3 py-1">
          {log.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-6 italic">暂无日志，连接后将显示协议消息</p>
          )}
          {log.map(entry => (
            <LogRow key={entry.id} entry={entry} onPlay={handlePlay} playingId={playingId} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
