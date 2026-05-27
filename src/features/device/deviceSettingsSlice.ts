import { StateCreator } from 'zustand'
import { STORAGE_KEYS, getStorageJSON, setStorageJSON } from '../../lib/persistence'

export interface DeviceSettingsState {
  volume: number
  brightness: number
  theme: 'light' | 'dark'
  setVolume: (v: number) => void
  setBrightness: (v: number) => void
  setTheme: (t: 'light' | 'dark') => void
}

type DeviceSettingsData = Omit<DeviceSettingsState, 'setVolume' | 'setBrightness' | 'setTheme'>

const defaults: DeviceSettingsData = {
  volume: 80,
  brightness: 100,
  theme: 'dark',
}

function loadDeviceSettings(): DeviceSettingsData {
  const saved = getStorageJSON<DeviceSettingsData>(STORAGE_KEYS.DEVICE_SETTINGS)
  return saved ? { ...defaults, ...saved } : defaults
}

function saveDeviceSettings(state: DeviceSettingsState): void {
  const data: DeviceSettingsData = {
    volume: state.volume,
    brightness: state.brightness,
    theme: state.theme,
  }
  setStorageJSON(STORAGE_KEYS.DEVICE_SETTINGS, data)
}

export const createDeviceSettingsSlice: StateCreator<DeviceSettingsState> = (set) => {
  const initial = loadDeviceSettings()
  return {
    ...initial,
    setVolume: (volume) => set((s) => { saveDeviceSettings({ ...s, volume }); return { volume } }),
    setBrightness: (brightness) => set((s) => { saveDeviceSettings({ ...s, brightness }); return { brightness } }),
    setTheme: (theme) => set((s) => { saveDeviceSettings({ ...s, theme }); return { theme } }),
  }
}
