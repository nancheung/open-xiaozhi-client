import { StateCreator } from 'zustand'
import { STORAGE_KEYS, getStorageString, setStorageString } from '../../lib/persistence'

export type ConnectionStatus =
  | 'idle' | 'ota_fetching' | 'activation_required' | 'activating' | 'ws_connecting' | 'handshaking'
  | 'mcp_init' | 'ready' | 'listening' | 'playing' | 'error'

export interface ConnectionConfig {
  otaUrl: string       // e.g. https://2662r3426b.vicp.fun/xiaozhi/ota/
  clientId: string     // UUID
}

export interface ConnectionState {
  status: ConnectionStatus
  errorMessage: string | null
  sessionId: string | null
  wsUrl: string | null
  token: string | null
  downstreamSampleRate: number
  config: ConnectionConfig
  // actions
  setStatus: (s: ConnectionStatus) => void
  setError: (msg: string) => void
  setSessionId: (id: string) => void
  setWsInfo: (url: string, token: string) => void
  setDownstreamSampleRate: (r: number) => void
  updateConfig: (patch: Partial<ConnectionConfig>) => void
  reset: () => void
}

function getOrCreateClientId(): string {
  const key = STORAGE_KEYS.CLIENT_ID
  const stored = getStorageString(key)
  if (stored) return stored
  const uuid = crypto.randomUUID()
  setStorageString(key, uuid)
  return uuid
}

function loadOtaUrl(): string {
  const stored = getStorageString(STORAGE_KEYS.OTA_URL)
  return stored || 'https://2662r3426b.vicp.fun/xiaozhi/ota/'
}

export const createConnectionSlice: StateCreator<ConnectionState> = (set) => ({
  status: 'idle',
  errorMessage: null,
  sessionId: null,
  wsUrl: null,
  token: null,
  downstreamSampleRate: 24000,
  config: {
    otaUrl: typeof localStorage !== 'undefined' ? loadOtaUrl() : 'https://2662r3426b.vicp.fun/xiaozhi/ota/',
    clientId: typeof localStorage !== 'undefined' ? getOrCreateClientId() : crypto.randomUUID(),
  },
  setStatus: (status) => set({ status, errorMessage: status !== 'error' ? null : undefined }),
  setError: (errorMessage) => set({ status: 'error', errorMessage }),
  setSessionId: (sessionId) => set({ sessionId }),
  setWsInfo: (wsUrl, token) => set({ wsUrl, token }),
  setDownstreamSampleRate: (downstreamSampleRate) => set({ downstreamSampleRate }),
  updateConfig: (patch) => set((s) => {
    const newConfig = { ...s.config, ...patch }
    if (patch.otaUrl !== undefined) {
      setStorageString(STORAGE_KEYS.OTA_URL, patch.otaUrl)
    }
    return { config: newConfig }
  }),
  reset: () => set({ status: 'idle', sessionId: null, wsUrl: null, token: null, errorMessage: null }),
})
