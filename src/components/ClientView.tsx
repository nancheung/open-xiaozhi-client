import { useStore } from '../store'
import { useConnection } from '../hooks/useConnection'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import type { ListenMode } from '../features/audio/audioSlice'

export function ClientView() {
  const emotionEmoji = useStore(s => s.emotionEmoji)
  const emotion = useStore(s => s.emotion)
  const sttText = useStore(s => s.sttText)
  const ttsText = useStore(s => s.ttsText)
  const audioStatus = useStore(s => s.audioStatus)
  const listenMode = useStore(s => s.listenMode)
  const status = useStore(s => s.status)
  const setListenMode = useStore(s => s.setListenMode)
  const setAudioStatus = useStore(s => s.setAudioStatus)
  const { sendListen, sendAbort } = useConnection()

  const isReady = status === 'ready'
  const isRecording = audioStatus === 'recording'
  const isPlaying = audioStatus === 'playing'

  function handleMicClick() {
    if (!isReady && !isRecording) return
    if (isRecording) {
      sendListen('stop')
      setAudioStatus('idle')
    } else {
      sendListen('start', { mode: listenMode })
      setAudioStatus('recording')
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 p-5 flex-1 overflow-auto">
      {/* 情绪显示 */}
      <div className="flex flex-col items-center gap-1 pt-2">
        <span className="text-7xl leading-none select-none">{emotionEmoji}</span>
        <span className="text-xs text-muted-foreground capitalize">{emotion}</span>
        {isPlaying && (
          <span className="text-xs text-primary animate-pulse">● 播放中</span>
        )}
      </div>

      {/* STT / TTS 文字 */}
      <div className="w-full space-y-2">
        <div className="rounded-md bg-muted/40 border p-2.5 min-h-10">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">语音识别</p>
          <p className="text-sm break-all">
            {sttText || <span className="text-muted-foreground/40 italic text-xs">等待语音...</span>}
          </p>
        </div>
        <div className="rounded-md bg-muted/40 border p-2.5 min-h-10">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">AI 回复</p>
          <p className="text-sm break-all">
            {ttsText || <span className="text-muted-foreground/40 italic text-xs">等待回复...</span>}
          </p>
        </div>
      </div>

      {/* 控制区 */}
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">监听模式</span>
          <Select
            value={listenMode}
            onValueChange={(v) => setListenMode(v as ListenMode)}
            disabled={isRecording}
          >
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="manual">手动</SelectItem>
              <SelectItem value="realtime">实时</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={handleMicClick}
          disabled={!isReady && !isRecording}
          className={[
            'w-20 h-20 rounded-full text-3xl transition-all select-none',
            'border-2 shadow-md active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            isRecording
              ? 'bg-destructive border-destructive text-white animate-pulse'
              : 'bg-primary border-primary text-primary-foreground hover:bg-primary/90',
          ].join(' ')}
          aria-label={isRecording ? '停止录音' : '开始录音'}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {(isReady || isRecording) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => { sendAbort(); setAudioStatus('idle') }}
          >
            中断
          </Button>
        )}
      </div>
    </div>
  )
}
