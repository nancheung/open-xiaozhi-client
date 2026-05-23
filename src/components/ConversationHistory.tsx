import { useEffect, useRef } from 'react'
import { Play, Square } from 'lucide-react'
import { useStore } from '../store'
import { ScrollArea } from './ui/scroll-area'
import { useAudioPlayback } from '../hooks/useAudioPlayback'
import type { ConversationMessage } from '../features/conversation/types'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function AudioPlayButton({
  id,
  chunks,
  direction,
  playingId,
  onPlay,
}: {
  id: string
  chunks: Uint8Array[]
  direction: 'in' | 'out'
  playingId: string | number | null
  onPlay: (id: string, chunks: Uint8Array[], direction: 'in' | 'out') => void
}) {
  const isPlaying = playingId === id
  return (
    <button
      onClick={() => onPlay(id, chunks, direction)}
      className={[
        'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors',
        isPlaying
          ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
          : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80',
      ].join(' ')}
      title={isPlaying ? '停止' : '播放音频'}
    >
      {isPlaying ? <Square size={10} /> : <Play size={10} />}
    </button>
  )
}

function UserBubble({ msg, playingId, onPlay }: {
  msg: ConversationMessage
  playingId: string | number | null
  onPlay: (id: string, chunks: Uint8Array[], direction: 'in' | 'out') => void
}) {
  const hasAudio = msg.audioChunks.length > 0 && msg.audioFinalized
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-end gap-1.5 max-w-[85%]">
        {hasAudio && (
          <AudioPlayButton id={msg.id} chunks={msg.audioChunks} direction="out" playingId={playingId} onPlay={onPlay} />
        )}
        <div className="bg-primary/15 border border-primary/25 rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed break-all">
          {msg.text}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground/50 pr-1">{formatTime(msg.timestamp)}</span>
    </div>
  )
}

function AssistantBubble({ msg, emotionEmoji, playingId, onPlay }: {
  msg: ConversationMessage
  emotionEmoji: string
  playingId: string | number | null
  onPlay: (id: string, chunks: Uint8Array[], direction: 'in' | 'out') => void
}) {
  const hasAudio = msg.audioChunks.length > 0 && msg.audioFinalized
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-end gap-1.5 max-w-[85%]">
        <span className="text-base leading-none flex-shrink-0 mb-0.5">{emotionEmoji}</span>
        <div className="bg-muted/50 border border-border/60 rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed break-all">
          {msg.text}
        </div>
        {hasAudio && (
          <AudioPlayButton id={msg.id} chunks={msg.audioChunks} direction="in" playingId={playingId} onPlay={onPlay} />
        )}
      </div>
      <span className="text-[10px] text-muted-foreground/50 pl-8">{formatTime(msg.timestamp)}</span>
    </div>
  )
}

export function ConversationHistory() {
  const messages = useStore(s => s.messages)
  const clearConversation = useStore(s => s.clearConversation)
  const emotionEmoji = useStore(s => s.emotionEmoji)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { play, playingId } = useAudioPlayback()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t">
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          对话历史
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            清空对话
          </button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 px-3 pb-4">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-6 italic">
              连接后开始对话，历史将显示在这里
            </p>
          )}
          {messages.map(msg =>
            msg.role === 'user' ? (
              <UserBubble key={msg.id} msg={msg} playingId={playingId} onPlay={play} />
            ) : (
              <AssistantBubble key={msg.id} msg={msg} emotionEmoji={emotionEmoji} playingId={playingId} onPlay={play} />
            )
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
