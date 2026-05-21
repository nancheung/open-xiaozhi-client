import { create } from 'zustand'
import { createConnectionSlice, type ConnectionState } from '../features/connection/connectionSlice'
import { createSettingsSlice, type SettingsState } from '../features/settings/settingsSlice'
import { createProtocolSlice, type ProtocolState } from '../features/protocol/protocolSlice'
import { createMcpSlice, type McpState } from '../features/mcp/mcpSlice'
import { createAudioSlice, type AudioState } from '../features/audio/audioSlice'
import { createIotSlice, type IotState } from '../features/iot/iotSlice'

export type AppState =
  ConnectionState & SettingsState & ProtocolState & McpState & AudioState & IotState

export const useStore = create<AppState>()((...args) => ({
  ...createConnectionSlice(...args),
  ...createSettingsSlice(...args),
  ...createProtocolSlice(...args),
  ...createMcpSlice(...args),
  ...createAudioSlice(...args),
  ...createIotSlice(...args),
}))
