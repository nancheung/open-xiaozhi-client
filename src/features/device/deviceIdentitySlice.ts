import { StateCreator } from 'zustand'
import { STORAGE_KEYS, getStorageString, setStorageString } from '../../lib/persistence'

export interface DeviceIdentityState {
  deviceId: string
  isEditing: boolean
  editDraft: string
  // actions
  randomizeDeviceId: () => void
  startEdit: () => void
  setEditDraft: (value: string) => void
  saveEdit: () => void
  cancelEdit: () => void
}

function generateRandomDeviceId(): string {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  ).join(':')
}

function getOrCreateDeviceId(): string {
  const key = STORAGE_KEYS.DEVICE_ID
  const stored = getStorageString(key)
  if (stored) return stored
  const mac = generateRandomDeviceId()
  setStorageString(key, mac)
  return mac
}

export const createDeviceIdentitySlice: StateCreator<DeviceIdentityState> = (set, get) => ({
  deviceId: typeof localStorage !== 'undefined' ? getOrCreateDeviceId() : 'AA:BB:CC:DD:EE:FF',
  isEditing: false,
  editDraft: '',

  randomizeDeviceId: () => {
    const newId = generateRandomDeviceId()
    setStorageString(STORAGE_KEYS.DEVICE_ID, newId)
    set({ deviceId: newId })
  },

  startEdit: () => {
    set({ isEditing: true, editDraft: get().deviceId })
  },

  setEditDraft: (value: string) => {
    set({ editDraft: value })
  },

  saveEdit: () => {
    const draft = get().editDraft
    setStorageString(STORAGE_KEYS.DEVICE_ID, draft)
    set({ deviceId: draft, isEditing: false, editDraft: '' })
  },

  cancelEdit: () => {
    set({ isEditing: false, editDraft: '' })
  },
})
