import { create } from 'zustand'
import { createConnectionSlice, type ConnectionState } from '../features/connection/connectionSlice'
import { createSettingsSlice, type SettingsState } from '../features/settings/settingsSlice'
import { createProtocolSlice, type ProtocolState } from '../features/protocol/protocolSlice'
import { createMcpSlice, type McpState } from '../features/mcp/mcpSlice'
import { createAudioSlice, type AudioState } from '../features/audio/audioSlice'
import { createIotSlice, type IotState } from '../features/iot/iotSlice'
import { createDeviceIdentitySlice, type DeviceIdentityState } from '../features/device/deviceIdentitySlice'
import { createDeviceSettingsSlice, type DeviceSettingsState } from '../features/device/deviceSettingsSlice'
import { createActivationSlice, type ActivationState } from '../features/activation/activationSlice'
import { createConversationSlice, type ConversationState } from '../features/conversation/conversationSlice'

export type AppState =
  ConnectionState & SettingsState & ProtocolState & McpState & AudioState &
  IotState & DeviceIdentityState & DeviceSettingsState & ActivationState & ConversationState

export const useStore = create<AppState>()((...args) => ({
  ...createConnectionSlice(...args),
  ...createSettingsSlice(...args),
  ...createProtocolSlice(...args),
  ...createMcpSlice(...args),
  ...createAudioSlice(...args),
  ...createIotSlice(...args),
  ...createDeviceIdentitySlice(...args),
  ...createDeviceSettingsSlice(...args),
  ...createActivationSlice(...args),
  ...createConversationSlice(...args),
}))
