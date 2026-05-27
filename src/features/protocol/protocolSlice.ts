import { StateCreator } from 'zustand'
import type { AlertMessage } from './types'

export type LogDirection = 'in' | 'out' | 'binary-in' | 'binary-out' | 'system'

export interface LogEntry {
  id: number
  timestamp: number  // Date.now()
  direction: LogDirection
  data: unknown      // JSON 对象 or string（binary 描述）
  // binary entries only:
  audioChunks?: Uint8Array[]
  frameCount?: number
  totalBytes?: number
}

let _id = 0
const nextId = () => ++_id

export interface ProtocolState {
  log: LogEntry[]
  alert: AlertMessage | null
  // actions
  addLog: (direction: LogDirection, data: unknown) => void
  addBinaryLog: (direction: 'binary-in' | 'binary-out', chunk: Uint8Array) => void
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
  addBinaryLog: (direction, chunk) => {
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maxEntries: number = (get as any)().maxLogEntries ?? 500
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mergeBinaryFrames: boolean = (get as any)().mergeBinaryFrames ?? true

      if (mergeBinaryFrames && s.log.length > 0) {
        // 向后扫描找同方向最后一条记录，跨越异方向的 binary 条目合并
        // 遇到非 binary 条目（in/out/system）时停止，表示新的会话轮次开始
        let mergeIdx = -1
        for (let i = s.log.length - 1; i >= 0; i--) {
          const e = s.log[i]
          if (e.direction === direction) {
            mergeIdx = i
            break
          }
          if (e.direction !== 'binary-in' && e.direction !== 'binary-out') {
            break
          }
        }

        if (mergeIdx >= 0) {
          const target = s.log[mergeIdx]
          const audioChunks = [...(target.audioChunks ?? []), chunk]
          const frameCount = (target.frameCount ?? 0) + 1
          const totalBytes = (target.totalBytes ?? 0) + chunk.byteLength
          const updated: LogEntry = {
            ...target,
            audioChunks,
            frameCount,
            totalBytes,
            data: `[${frameCount} frames, ${totalBytes} bytes]`,
          }
          return { log: [...s.log.slice(0, mergeIdx), updated, ...s.log.slice(mergeIdx + 1)] }
        }
      }

      const entry: LogEntry = {
        id: nextId(),
        timestamp: Date.now(),
        direction,
        data: `[1 frame, ${chunk.byteLength} bytes]`,
        audioChunks: [chunk],
        frameCount: 1,
        totalBytes: chunk.byteLength,
      }
      const log = [...s.log, entry].slice(-maxEntries)
      return { log }
    })
  },
  clearLog: () => set({ log: [] }),
  setAlert: (alert) => set({ alert }),
})
