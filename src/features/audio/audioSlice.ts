import { StateCreator } from 'zustand'
import type { EmotionType } from '../protocol/types'

export type AudioStatus = 'idle' | 'recording' | 'playing'
export type ListenMode = 'auto' | 'manual' | 'realtime'

export interface AudioState {
  audioStatus: AudioStatus
  listenMode: ListenMode
  isTTSActive: boolean               // TTS 播放期间为 true（与 audioStatus 解耦，供实时模式使用）
  sttText: string
  ttsText: string        // 当前字幕（sentence_start 的 text）
  emotion: EmotionType
  emotionEmoji: string
  audioError: string | null          // 麦克风权限拒绝 / 解码失败等用户可见错误
  audioContextSuspended: boolean     // 播放 AudioContext 被浏览器策略挂起
  // actions
  setAudioStatus: (s: AudioStatus) => void
  setListenMode: (m: ListenMode) => void
  setIsTTSActive: (v: boolean) => void
  setSTT: (text: string) => void
  setTTSText: (text: string) => void
  setEmotion: (emotion: EmotionType, emoji: string) => void
  setAudioError: (e: string | null) => void
  setAudioContextSuspended: (s: boolean) => void
  resetAudio: () => void
}

export const createAudioSlice: StateCreator<AudioState> = (set) => ({
  audioStatus: 'idle',
  listenMode: 'auto',
  isTTSActive: false,
  sttText: '',
  ttsText: '',
  emotion: 'neutral',
  emotionEmoji: '😶',
  audioError: null,
  audioContextSuspended: false,
  setAudioStatus: (audioStatus) => set({ audioStatus }),
  setListenMode: (listenMode) => set({ listenMode }),
  setIsTTSActive: (isTTSActive) => set({ isTTSActive }),
  setSTT: (sttText) => set({ sttText }),
  setTTSText: (ttsText) => set({ ttsText }),
  setEmotion: (emotion, emotionEmoji) => set({ emotion, emotionEmoji }),
  setAudioError: (audioError) => set({ audioError }),
  setAudioContextSuspended: (audioContextSuspended) => set({ audioContextSuspended }),
  resetAudio: () => set({ audioStatus: 'idle', isTTSActive: false, sttText: '', ttsText: '' }),
})
