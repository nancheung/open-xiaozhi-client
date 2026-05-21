import { StateCreator } from 'zustand'
import type { McpMockState } from './tools'

export interface McpState {
  mockState: McpMockState
  // actions
  updateMockState: (patch: Partial<McpMockState>) => void
}

export const createMcpSlice: StateCreator<McpState> = (set) => ({
  mockState: {
    volume: 70,
    brightness: 80,
    theme: 'dark',
    battery: { level: 85, charging: false },
    network: { connected: true, ssid: 'HomeWiFi', rssi: -55 },
    forceError: false,
  },
  updateMockState: (patch) =>
    set((s) => ({ mockState: { ...s.mockState, ...patch } })),
})
