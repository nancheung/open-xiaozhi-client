import { StateCreator } from 'zustand'

export interface DeviceSettingsState {
  volume: number
  brightness: number
  theme: 'light' | 'dark'
  setVolume: (v: number) => void
  setBrightness: (v: number) => void
  setTheme: (t: 'light' | 'dark') => void
}

export const createDeviceSettingsSlice: StateCreator<DeviceSettingsState> = (set) => ({
  volume: 80,
  brightness: 100,
  theme: 'dark',
  setVolume: (volume) => set({ volume }),
  setBrightness: (brightness) => set({ brightness }),
  setTheme: (theme) => set({ theme }),
})
