import { StateCreator } from 'zustand'

export type ConnectionStatus =
  | 'idle' | 'ota_fetching' | 'ws_connecting' | 'handshaking'
  | 'mcp_init' | 'ready' | 'listening' | 'playing' | 'error'

export interface ConnectionConfig {
  otaUrl: string       // e.g. http://localhost:8003
  deviceId: string     // AA:BB:CC:DD:EE:FF
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

/** 生成随机 MAC 格式 Device-Id，持久化到 localStorage */
function getOrCreateDeviceId(): string {
  const key = 'xiaozhi_device_id'
  const stored = localStorage.getItem(key)
  if (stored) return stored
  const mac = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  ).join(':')
  localStorage.setItem(key, mac)
  return mac
}

function getOrCreateClientId(): string {
  const key = 'xiaozhi_client_id'
  const stored = localStorage.getItem(key)
  if (stored) return stored
  const uuid = crypto.randomUUID()
  localStorage.setItem(key, uuid)
  return uuid
}

export const createConnectionSlice: StateCreator<ConnectionState> = (set) => ({
  status: 'idle',
  errorMessage: null,
  sessionId: null,
  wsUrl: null,
  token: null,
  downstreamSampleRate: 24000,
  config: {
    otaUrl: 'http://localhost:8003',
    deviceId: typeof localStorage !== 'undefined' ? getOrCreateDeviceId() : 'AA:BB:CC:DD:EE:FF',
    clientId: typeof localStorage !== 'undefined' ? getOrCreateClientId() : crypto.randomUUID(),
  },
  setStatus: (status) => set({ status, errorMessage: status !== 'error' ? null : undefined }),
  setError: (errorMessage) => set({ status: 'error', errorMessage }),
  setSessionId: (sessionId) => set({ sessionId }),
  setWsInfo: (wsUrl, token) => set({ wsUrl, token }),
  setDownstreamSampleRate: (downstreamSampleRate) => set({ downstreamSampleRate }),
  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  reset: () => set({ status: 'idle', sessionId: null, wsUrl: null, token: null, errorMessage: null }),
})
