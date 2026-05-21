import { StateCreator } from 'zustand'
import type { IotDescriptor, IotStateDevice } from './defaultDescriptors'
import { DEFAULT_DESCRIPTORS, DEFAULT_STATES } from './defaultDescriptors'
import type { IoTCommandMessage } from '../protocol/types'

export interface IotState {
  descriptors: IotDescriptor[]
  deviceStates: IotStateDevice[]
  descriptorsJson: string          // JSON 编辑器内容
  receivedCommands: IoTCommandMessage[]
  jsonError: string | null
  // actions
  setDescriptorsJson: (json: string) => void
  applyJsonEdit: () => boolean     // 解析 JSON 并更新 descriptors，返回是否成功
  addReceivedCommand: (cmd: IoTCommandMessage) => void
  clearCommands: () => void
}

const initialJson = JSON.stringify(
  { descriptors: DEFAULT_DESCRIPTORS, states: DEFAULT_STATES },
  null, 2
)

export const createIotSlice: StateCreator<IotState> = (set, get) => ({
  descriptors: DEFAULT_DESCRIPTORS,
  deviceStates: DEFAULT_STATES,
  descriptorsJson: initialJson,
  receivedCommands: [],
  jsonError: null,
  setDescriptorsJson: (descriptorsJson) => set({ descriptorsJson, jsonError: null }),
  applyJsonEdit: () => {
    try {
      const parsed = JSON.parse(get().descriptorsJson)
      set({ descriptors: parsed.descriptors, deviceStates: parsed.states, jsonError: null })
      return true
    } catch (e) {
      set({ jsonError: (e as Error).message })
      return false
    }
  },
  addReceivedCommand: (cmd) =>
    set((s) => ({ receivedCommands: [...s.receivedCommands, cmd].slice(-50) })),
  clearCommands: () => set({ receivedCommands: [] }),
})
