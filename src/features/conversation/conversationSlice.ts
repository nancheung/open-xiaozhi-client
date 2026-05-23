import type { StateCreator } from 'zustand'
import type { ConversationMessage } from './types'

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

function findLatestOpenAssistantIndex(messages: ConversationMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'assistant' && message.audioFinalized === false) return index
  }
  return -1
}

function isEmptyOpenAssistantMessage(message: ConversationMessage): boolean {
  return message.role === 'assistant'
    && message.audioFinalized === false
    && message.text === ''
    && message.audioChunks.length === 0
}

function finalizeAllOpenAssistants(messages: ConversationMessage[]): ConversationMessage[] {
  let changed = false
  const finalizedMessages = messages.flatMap((message) => {
    if (isEmptyOpenAssistantMessage(message)) {
      changed = true
      return []
    }
    if (message.role !== 'assistant' || message.audioFinalized) return [message]
    changed = true
    return [{ ...message, audioFinalized: true }]
  })
  return changed ? finalizedMessages : messages
}

function finalizeStaleOpenAssistants(messages: ConversationMessage[]): ConversationMessage[] {
  const latestOpenAssistantIndex = findLatestOpenAssistantIndex(messages)
  if (latestOpenAssistantIndex <= 0) return messages

  let changed = false
  const finalizedMessages = messages.flatMap((message, index) => {
    if (index === latestOpenAssistantIndex || message.role !== 'assistant' || message.audioFinalized) {
      return [message]
    }
    if (isEmptyOpenAssistantMessage(message)) {
      changed = true
      return []
    }
    changed = true
    return [{ ...message, audioFinalized: true }]
  })

  return changed ? finalizedMessages : messages
}

export const createConversationSlice: StateCreator<ConversationState, [], [], ConversationState> = (set) => ({
  messages: [],
  pendingUserAudio: [],

  appendPendingUserAudio: (chunk) =>
    set((s) => ({ pendingUserAudio: [...s.pendingUserAudio, chunk] })),

  commitUserMessage: (text) =>
    set((s) => {
      const messages = finalizeAllOpenAssistants(s.messages)
      return {
        messages: [
          ...messages,
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
      }
    }),

  beginAssistantTurn: () =>
    set((s) => {
      const openAssistantIndex = findLatestOpenAssistantIndex(s.messages)
      if (openAssistantIndex !== -1 && openAssistantIndex === s.messages.length - 1) {
        const messages = finalizeStaleOpenAssistants(s.messages)
        return messages === s.messages ? s : { messages }
      }

      const messages = finalizeAllOpenAssistants(s.messages)
      return {
        messages: [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: '',
            timestamp: Date.now(),
            audioChunks: [],
            audioFinalized: false,
          },
        ],
      }
    }),

  appendAssistantText: (text) =>
    set((s) => {
      if (s.messages.length === 0) return s
      const last = s.messages[s.messages.length - 1]
      if (last.role !== 'assistant' || last.audioFinalized) return s
      const sep = last.text ? ' ' : ''
      const updated = { ...last, text: last.text + sep + text }
      return { messages: [...s.messages.slice(0, -1), updated] }
    }),

  appendAssistantAudio: (chunk) =>
    set((s) => {
      if (s.messages.length === 0) return s
      const last = s.messages[s.messages.length - 1]
      if (last.role !== 'assistant' || last.audioFinalized) return s
      const updated = { ...last, audioChunks: [...last.audioChunks, chunk] }
      return { messages: [...s.messages.slice(0, -1), updated] }
    }),

  finalizeAssistantMessage: () =>
    set((s) => {
      const messages = finalizeAllOpenAssistants(s.messages)
      return messages === s.messages ? s : { messages }
    }),

  clearConversation: () => set({ messages: [], pendingUserAudio: [] }),
})
