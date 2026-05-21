import { StateCreator } from 'zustand'
import { STORAGE_KEYS, getStorageJSON, setStorageJSON } from '../../lib/persistence'

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

type SettingsData = Omit<SettingsState, 'updateHelloFeatures' | 'updateHelloAudio' | 'updateSettings'>

const defaults: SettingsData = {
  helloVersion: 3,
  helloFeatures: { mcp: true, emoji: true },
  helloAudio: { format: 'opus', sample_rate: 16000, channels: 1, frame_duration: 60 },
  handshakeTimeoutMs: 10000,
  heartbeatIntervalMs: 0,
  maxLogEntries: 500,
  mergeBinaryFrames: true,
}

function loadSettings(): SettingsData {
  const saved = getStorageJSON<SettingsData>(STORAGE_KEYS.SETTINGS)
  return saved ? { ...defaults, ...saved } : defaults
}

function saveSettings(state: SettingsState): void {
  const data: SettingsData = {
    helloVersion: state.helloVersion,
    helloFeatures: state.helloFeatures,
    helloAudio: state.helloAudio,
    handshakeTimeoutMs: state.handshakeTimeoutMs,
    heartbeatIntervalMs: state.heartbeatIntervalMs,
    maxLogEntries: state.maxLogEntries,
    mergeBinaryFrames: state.mergeBinaryFrames,
  }
  setStorageJSON(STORAGE_KEYS.SETTINGS, data)
}

export const createSettingsSlice: StateCreator<SettingsState> = (set) => {
  const initial = loadSettings()
  return {
    ...initial,
    updateHelloFeatures: (f) => set((s) => {
      const newState = { ...s, helloFeatures: { ...s.helloFeatures, ...f } }
      saveSettings(newState)
      return { helloFeatures: newState.helloFeatures }
    }),
    updateHelloAudio: (a) => set((s) => {
      const newState = { ...s, helloAudio: { ...s.helloAudio, ...a } }
      saveSettings(newState)
      return { helloAudio: newState.helloAudio }
    }),
    updateSettings: (patch) => set((s) => {
      const newState = { ...s, ...patch }
      saveSettings(newState)
      return patch
    }),
  }
}
