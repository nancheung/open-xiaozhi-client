import type { StateCreator } from 'zustand'
import type { ConversationMessage } from '../../core/domain/conversation-log/types'
import * as transcript from '../../core/domain/conversation-log/transcript'

export interface ConversationState {
  messages: ConversationMessage[]
  pendingUserAudio: Uint8Array[]
  appendPendingUserAudio: (chunk: Uint8Array) => void
  commitUserMessage: (text: string) => void
  beginAssistantTurn: () => void
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
    set((s) => transcript.commitUserMessage(s.messages, s.pendingUserAudio, text)),

  beginAssistantTurn: () =>
    set((s) => {
      const messages = transcript.beginAssistantTurn(s.messages)
      return messages === s.messages ? s : { messages }
    }),

  appendAssistantText: (text) =>
    set((s) => {
      const messages = transcript.appendAssistantText(s.messages, text)
      return messages === s.messages ? s : { messages }
    }),

  appendAssistantAudio: (chunk) =>
    set((s) => {
      const messages = transcript.appendAssistantAudio(s.messages, chunk)
      return messages === s.messages ? s : { messages }
    }),

  finalizeAssistantMessage: () =>
    set((s) => {
      const messages = transcript.finalizeAssistantMessage(s.messages)
      return messages === s.messages ? s : { messages }
    }),

  clearConversation: () => set({ messages: [], pendingUserAudio: [] }),
})
