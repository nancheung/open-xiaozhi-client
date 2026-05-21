import { StateCreator } from 'zustand'

export interface HelloFeatures { mcp: boolean; emoji: boolean }
export interface HelloAudioParams {
  format: 'opus'; sample_rate: 8000 | 12000 | 16000 | 24000 | 48000
  channels: number; frame_duration: number
}

export interface SettingsState {
  helloVersion: number
  helloFeatures: HelloFeatures
  helloAudio: HelloAudioParams
  handshakeTimeoutMs: number
  heartbeatIntervalMs: number   // 0 = 禁用
  maxLogEntries: number
  mergeBinaryFrames: boolean
  // actions
  updateHelloFeatures: (f: Partial<HelloFeatures>) => void
  updateHelloAudio: (a: Partial<HelloAudioParams>) => void
  updateSettings: (patch: Partial<Omit<SettingsState, 'updateHelloFeatures' | 'updateHelloAudio' | 'updateSettings'>>) => void
}

export const createSettingsSlice: StateCreator<SettingsState> = (set) => ({
  helloVersion: 3,
  helloFeatures: { mcp: true, emoji: true },
  helloAudio: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 60 },
  handshakeTimeoutMs: 10000,
  heartbeatIntervalMs: 0,
  maxLogEntries: 500,
  mergeBinaryFrames: true,
  updateHelloFeatures: (f) => set((s) => ({ helloFeatures: { ...s.helloFeatures, ...f } })),
  updateHelloAudio: (a) => set((s) => ({ helloAudio: { ...s.helloAudio, ...a } })),
  updateSettings: (patch) => set(patch),
})
