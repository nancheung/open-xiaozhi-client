/* ClientView.tsx — Layout B
 *
 * Replaces the old version. Drop-in: same store hooks, same handlers,
 * just a new layout.
 *
 * Layout:
 *   - Narrow (panel width < 700px): compact top status strip → conversation
 *     history → bottom input dock (typing strip + mode-icon + label + mic).
 *   - Wide (panel width ≥ 700px): two columns inside the AI panel:
 *       LEFT  = pure conversation history (no chrome), with floating "clear"
 *               button top-right.
 *       RIGHT = 340px centered command center: big emoji → emotion + state →
 *               live waveform/transcript card → big mic button → label →
 *               mode pill.
 *
 * Removed from the old layout:
 *   - The big standalone emotion display
 *   - The separate "语音识别" and "AI 回复" boxes (their content is now the
 *     inline typing strip / live card)
 */

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X, Radio, Sparkles, Phone } from 'lucide-react'
import { useStore } from '../store'
import { useConnection } from '../hooks/useConnection'
import { useAudio } from '../hooks/useAudio'
import { Button } from './ui/button'
import { VolumeBar } from './VolumeBar'
import { WaveformBars } from './WaveformBars'
import { ConversationHistory } from './ConversationHistory'
import type { ListenMode } from '../features/audio/audioSlice'

const WIDE_BREAKPOINT = 700

// ─── Listen-mode metadata: the three modes mapped to concrete chat metaphors ───
type ModeInfo = { label: string; desc: string; Icon: typeof Radio }
const MODES: Record<ListenMode, ModeInfo> = {
  manual:   { label: '对讲机',   desc: '手动，自己选择什么时候说', Icon: Radio },
  auto:     { label: '智能助理', desc: '自动，自动识别开始结束',       Icon: Sparkles },
  realtime: { label: '通话',     desc: '实时，通话模式',       Icon: Phone },
}
const cycleMode = (m: ListenMode): ListenMode =>
  m === 'auto' ? 'manual' : m === 'manual' ? 'realtime' : 'auto'

// ─── Tiny pure-CSS waveform (for inline typing strip) ───
function MiniWaveform({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-end gap-[2px] h-3 ${className}`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-sm"
          style={{
            height: '100%',
            animation: `cv-wave 1s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </span>
  )
}

export function ClientView() {
  const emotionEmoji = useStore(s => s.emotionEmoji)
  const emotion = useStore(s => s.emotion)
  const sttText = useStore(s => s.sttText)
  const activationPayload = useStore(s => s.activationPayload)
  const activationMessage = activationPayload?.message ?? ''
  const ttsText = useStore(s => s.ttsText)
  const audioStatus = useStore(s => s.audioStatus)
  const listenMode = useStore(s => s.listenMode)
  const isTTSActive = useStore(s => s.isTTSActive)
  const status = useStore(s => s.status)
  const audioError = useStore(s => s.audioError)
  const audioContextSuspended = useStore(s => s.audioContextSuspended)
  const setListenMode = useStore(s => s.setListenMode)
  const setAudioStatus = useStore(s => s.setAudioStatus)
  const setAudioError = useStore(s => s.setAudioError)
  const { sendListen, sendAbort } = useConnection()
  const { recordingAnalyserRef, playbackAnalyserRef, resumeAudioContext } = useAudio()

  const isReady = status === 'ready'
  const isRecording = audioStatus === 'recording'
  const isPlaying = isTTSActive

  // Derive a single "phase" for UI choices
  const phase: 'idle' | 'recording' | 'speaking' =
    isRecording ? 'recording' : isPlaying ? 'speaking' : 'idle'

  // ─── width detection (which layout to render) ───
  const containerRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setWide(el.clientWidth >= WIDE_BREAKPOINT)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const mode = MODES[listenMode]
  const ModeIcon = mode.Icon

  function handleMicClick() {
    if (!isReady && !isRecording) return
    if (isRecording) {
      if (listenMode === 'realtime') {
        sendAbort()
      } else {
        sendListen('stop')
      }
      setAudioStatus('idle')
    } else {
      if (isTTSActive) sendAbort()
      sendListen('start', { mode: listenMode })
      setAudioStatus('recording')
    }
  }

  function handleCycleMode() {
    if (isRecording) return
    setListenMode(cycleMode(listenMode))
  }

  // ─── Sub-pieces (shared by both layouts) ───
  const audioBanner = audioContextSuspended && (
    <button
      onClick={resumeAudioContext}
      className="w-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded px-2 py-1.5 text-center hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
    >
      🔊 点击恢复音频播放
    </button>
  )

  const errorBanner = audioError && (
    <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 text-center mx-3 mb-2">
      {audioError}
      <button
        onClick={() => setAudioError(null)}
        className="ml-2 underline hover:no-underline"
      >
        关闭
      </button>
    </div>
  )

  // ─── Activation banner (shown regardless of phase when device needs activation) ───
  const activationBanner = activationPayload && (
    <div className="mx-3 mt-2 rounded-lg border border-amber-400/50 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2 text-center">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-400">{activationMessage}</p>
    </div>
  )

  // ─── Narrow mode pieces ───
  const statusStrip = (
    <div className="flex items-center gap-2.5 px-4 py-2 border-b shrink-0 bg-card">
      <span className="text-xl leading-none select-none">{emotionEmoji}</span>
      <span className="text-sm font-medium capitalize">{emotion}</span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {phase !== 'idle' && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${phase === 'recording' ? 'bg-destructive' : 'bg-emerald-500'}`}
            style={{ animation: 'cv-blink 1.5s infinite' }}
          />
        )}
        <span>{phase === 'idle' ? '已就绪' : phase === 'recording' ? '录音中' : '播放中'}</span>
      </span>
    </div>
  )

  const typingStrip = phase !== 'idle' && (
    <div className="text-xs text-muted-foreground px-3 py-1.5 flex items-center gap-2 min-h-7">
      {phase === 'recording' && (
        <>
          <span className="text-destructive"><MiniWaveform /></span>
          <span className="text-foreground font-medium truncate">
            {sttText || '正在听...'}
          </span>
        </>
      )}
      {phase === 'speaking' && (
        <>
          <span className="text-primary"><MiniWaveform /></span>
          <span className="text-foreground font-medium truncate">
            {activationPayload ? activationMessage : (ttsText || `${emotionEmoji} 正在回复...`)}
          </span>
        </>
      )}
    </div>
  )

  const bottomDock = (
    <div className="border-t bg-card px-3 py-2.5 shrink-0">
      {typingStrip}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleCycleMode}
          disabled={isRecording}
          title={`${mode.label} · 点击切换`}
        >
          <ModeIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center leading-tight">
          <div className={`text-xs font-medium ${isRecording ? 'text-destructive' : 'text-muted-foreground'}`}>
            {isRecording ? '点击结束' : isPlaying ? '点击打断' : '点击说话'}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">
            {mode.label} · {mode.desc}
          </div>
        </div>
        <button
          onClick={handleMicClick}
          disabled={!isReady && !isRecording}
          className={[
            'shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all',
            'border-2 shadow-md active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            isRecording
              ? 'bg-destructive border-destructive text-white animate-pulse'
              : 'bg-primary border-primary text-primary-foreground hover:bg-primary/90',
          ].join(' ')}
          aria-label={isRecording ? '停止录音' : '开始录音'}
        >
          {isRecording ? <Square className="h-5 w-5" fill="currentColor" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
      {isRecording && (
        <div className="flex justify-center mt-2">
          <VolumeBar analyser={recordingAnalyserRef.current} />
        </div>
      )}
      {(isReady || isRecording) && listenMode !== 'realtime' && (
        <div className="flex justify-center mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-muted-foreground"
            onClick={() => { sendAbort(); setAudioStatus('idle') }}
          >
            中断
          </Button>
        </div>
      )}
    </div>
  )

  // ─── Wide-mode right column ───
  const liveBoxIdle = activationPayload ? (
    <p className="text-xs font-medium text-amber-800 dark:text-amber-400 text-center m-0">{activationMessage}</p>
  ) : (
    <p className="text-[11px] text-muted-foreground/60 italic m-0">点击下方麦克风开始</p>
  )

  const liveBox = (
    <div
      className={[
        'w-full min-h-[88px] flex flex-col items-center justify-center gap-2.5 p-3 rounded-xl transition-colors',
        phase === 'idle' ? 'border border-dashed border-transparent' : 'border border-border bg-muted/40',
      ].join(' ')}
    >
      {phase === 'idle' && liveBoxIdle}
      {phase === 'recording' && (
        <>
          <div className="w-full">
            <VolumeBar analyser={recordingAnalyserRef.current} />
          </div>
          <p className="text-xs leading-snug text-center text-foreground/80 m-0 break-all">
            {sttText || '正在听...'}
          </p>
        </>
      )}
      {phase === 'speaking' && (
        <>
          <div className="w-full">
            <WaveformBars analyser={playbackAnalyserRef.current} />
          </div>
          <p className="text-xs leading-snug text-center text-foreground/80 m-0 break-all">
            {activationPayload ? activationMessage : (ttsText || '正在回复...')}
          </p>
        </>
      )}
    </div>
  )

  const commandCenter = (
    <div className="w-[340px] shrink-0 border-l bg-gradient-to-b from-muted/30 to-background flex flex-col items-center justify-center gap-4 px-5 py-6">
      <div
        className="text-[72px] leading-none select-none"
        style={{
          filter: phase === 'speaking' ? 'drop-shadow(0 0 20px rgba(99,102,241,.4))' : 'none',
          animation: phase === 'speaking' ? 'cv-breathe 2.4s ease-in-out infinite' : 'none',
          transition: 'filter .3s',
        }}
      >
        {emotionEmoji}
      </div>

      <div className="text-center">
        <div className="text-[15px] font-medium capitalize">{emotion}</div>
        <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
          {phase !== 'idle' && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${phase === 'recording' ? 'bg-destructive' : 'bg-emerald-500'}`}
              style={{ animation: 'cv-blink 1.5s infinite' }}
            />
          )}
          <span>{phase === 'idle' ? '已就绪' : phase === 'recording' ? '录音中' : '播放中'}</span>
        </div>
      </div>

      {liveBox}

      <button
        onClick={handleMicClick}
        disabled={!isReady && !isRecording}
        className={[
          'mt-1 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all',
          'border-2 shadow-md active:scale-95',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isRecording
            ? 'bg-destructive border-destructive text-white animate-pulse'
            : 'bg-primary border-primary text-primary-foreground hover:bg-primary/90',
        ].join(' ')}
        aria-label={isRecording ? '停止录音' : '开始录音'}
      >
        {isRecording ? <Square className="h-7 w-7" fill="currentColor" /> : <Mic className="h-7 w-7" />}
      </button>

      <div className="text-center -mt-1">
        <div className={`text-[13px] font-medium ${isRecording ? 'text-destructive' : 'text-foreground/80'}`}>
          {isRecording ? '点击结束' : isPlaying ? '点击打断' : '点击说话'}
        </div>
      </div>

      <button
        onClick={handleCycleMode}
        disabled={isRecording}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted hover:border-border text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title="点击切换模式"
      >
        <ModeIcon className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{mode.label}</span>
        <span className="text-muted-foreground/70 truncate max-w-[140px]">· {mode.desc}</span>
      </button>

      {(isReady || isRecording) && listenMode !== 'realtime' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-muted-foreground"
          onClick={() => { sendAbort(); setAudioStatus('idle') }}
        >
          <X className="h-3 w-3 mr-1" />
          中断
        </Button>
      )}
    </div>
  )

  // ─── Render ───
  return (
    <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden relative">
      {audioBanner && <div className="px-3 pt-2">{audioBanner}</div>}

      {wide ? (
        // ─── WIDE LAYOUT — dual column ───
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col relative">
            {errorBanner && <div className="shrink-0">{errorBanner}</div>}
            <ConversationHistory hideHeader />
          </div>
          {commandCenter}
        </div>
      ) : (
        // ─── NARROW LAYOUT — vertical stack ───
        <>
          {statusStrip}
          {activationBanner}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ConversationHistory />
          </div>
          {errorBanner}
          {bottomDock}
        </>
      )}
    </div>
  )
}
