import { StateCreator } from 'zustand'
import type { AlertMessage } from './types'

export type LogDirection = 'in' | 'out' | 'binary-in' | 'binary-out' | 'system'

export interface LogEntry {
  id: number
  timestamp: number  // Date.now()
  direction: LogDirection
  data: unknown      // JSON 对象 or string（binary 描述）
}

let _id = 0
const nextId = () => ++_id

export interface ProtocolState {
  log: LogEntry[]
  alert: AlertMessage | null
  // actions
  addLog: (direction: LogDirection, data: unknown) => void
  clearLog: () => void
  setAlert: (a: AlertMessage | null) => void
}

export const createProtocolSlice: StateCreator<ProtocolState, [], [], ProtocolState> = (set, get) => ({
  log: [],
  alert: null,
  addLog: (direction, data) => {
    set((s) => {
      const entry: LogEntry = { id: nextId(), timestamp: Date.now(), direction, data }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maxEntries: number = (get as any)().maxLogEntries ?? 500
      const log = [...s.log, entry].slice(-maxEntries)
      return { log }
    })
  },
  clearLog: () => set({ log: [] }),
  setAlert: (alert) => set({ alert }),
})
