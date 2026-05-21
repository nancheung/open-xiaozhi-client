import { StateCreator } from 'zustand'

export interface ActivationPayload {
  message: string
  [key: string]: unknown
}

export interface ActivationState {
  activationPayload: ActivationPayload | null
  // actions
  setActivation: (payload: ActivationPayload) => void
  clearActivation: () => void
}

export const createActivationSlice: StateCreator<ActivationState> = (set) => ({
  activationPayload: null,
  setActivation: (activationPayload) => set({ activationPayload }),
  clearActivation: () => set({ activationPayload: null }),
})
