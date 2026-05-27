import { StateCreator } from 'zustand'
import type { IoTCommandMessage } from '../protocol/types'

export interface IotState {
  receivedCommands: IoTCommandMessage[]
  addReceivedCommand: (cmd: IoTCommandMessage) => void
  clearCommands: () => void
}

export const createIotSlice: StateCreator<IotState> = (set) => ({
  receivedCommands: [],
  addReceivedCommand: (cmd) =>
    set((s) => ({ receivedCommands: [...s.receivedCommands, cmd].slice(-50) })),
  clearCommands: () => set({ receivedCommands: [] }),
})
