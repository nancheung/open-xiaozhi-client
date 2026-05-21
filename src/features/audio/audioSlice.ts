import { StateCreator } from 'zustand'
import type { EmotionType } from '../protocol/types'

export type AudioStatus = 'idle' | 'recording' | 'playing'
export type ListenMode = 'auto' | 'manual' | 'realtime'

export interface AudioState {
  audioStatus: AudioStatus
  listenMode: ListenMode
  sttText: string
  ttsText: string        // 当前字幕（sentence_start 的 text）
  emotion: EmotionType
  emotionEmoji: string
  // actions
  setAudioStatus: (s: AudioStatus) => void
  setListenMode: (m: ListenMode) => void
  setSTT: (text: string) => void
  setTTSText: (text: string) => void
  setEmotion: (emotion: EmotionType, emoji: string) => void
  resetAudio: () => void
}

export const createAudioSlice: StateCreator<AudioState> = (set) => ({
  audioStatus: 'idle',
  listenMode: 'auto',
  sttText: '',
  ttsText: '',
  emotion: 'neutral',
  emotionEmoji: '😶',
  setAudioStatus: (audioStatus) => set({ audioStatus }),
  setListenMode: (listenMode) => set({ listenMode }),
  setSTT: (sttText) => set({ sttText }),
  setTTSText: (ttsText) => set({ ttsText }),
  setEmotion: (emotion, emotionEmoji) => set({ emotion, emotionEmoji }),
  resetAudio: () => set({ audioStatus: 'idle', sttText: '', ttsText: '' }),
})
