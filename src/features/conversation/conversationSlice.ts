import type { StateCreator } from 'zustand'
import type { ConversationMessage } from './types'

export interface ConversationState {
  messages: ConversationMessage[]
  pendingUserAudio: Uint8Array[]
  appendPendingUserAudio: (chunk: Uint8Array) => void
  commitUserMessage: (text: string) => void
  startAssistantMessage: (text: string) => void
  appendAssistantText: (text: string) => void
  appendAssistantAudio: (chunk: Uint8Array) => void
  finalizeAssistantMessage: () => void
  clearConversation: () => void
}

export const createConversationSlice: StateCreator<ConversationState, [], [], ConversationState> = (set) => ({
  messages: [],
  pendingUserAudio: [],

  appendPendingUserAudio: (chunk) =>
    set((s) => ({ pendingUserAudio: [...s.pendingUserAudio, chunk] })),

  commitUserMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          text,
          timestamp: Date.now(),
          audioChunks: s.pendingUserAudio,
          audioFinalized: true,
        },
      ],
      pendingUserAudio: [],
    })),

  startAssistantMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text,
          timestamp: Date.now(),
          audioChunks: [],
          audioFinalized: false,
        },
      ],
    })),

  appendAssistantText: (text) =>
    set((s) => {
      if (s.messages.length === 0) return s
      const last = s.messages[s.messages.length - 1]
      if (last.role !== 'assistant') return s
      const sep = last.text ? ' ' : ''
      const updated = { ...last, text: last.text + sep + text }
      return { messages: [...s.messages.slice(0, -1), updated] }
    }),

  appendAssistantAudio: (chunk) =>
    set((s) => {
      if (s.messages.length === 0) return s
      const last = s.messages[s.messages.length - 1]
      if (last.role !== 'assistant') return s
      const updated = { ...last, audioChunks: [...last.audioChunks, chunk] }
      return { messages: [...s.messages.slice(0, -1), updated] }
    }),

  finalizeAssistantMessage: () =>
    set((s) => {
      if (s.messages.length === 0) return s
      const last = s.messages[s.messages.length - 1]
      if (last.role !== 'assistant') return s
      const updated = { ...last, audioFinalized: true }
      return { messages: [...s.messages.slice(0, -1), updated] }
    }),

  clearConversation: () => set({ messages: [], pendingUserAudio: [] }),
})
