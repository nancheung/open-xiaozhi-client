// 对话记录的纯归约逻辑（从原 conversationSlice 抽出，行为逐字保持一致）。
// 这些函数不依赖 Zustand / React，可独立单元测试，由投影层与会话编排调用。

import type { ConversationMessage } from './types'

export function findLatestOpenAssistantIndex(messages: ConversationMessage[]): number {
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

export function finalizeAllOpenAssistants(messages: ConversationMessage[]): ConversationMessage[] {
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

export function finalizeStaleOpenAssistants(messages: ConversationMessage[]): ConversationMessage[] {
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

function newAssistantMessage(): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: '',
    timestamp: Date.now(),
    audioChunks: [],
    audioFinalized: false,
  }
}

export interface CommitUserResult {
  messages: ConversationMessage[]
  pendingUserAudio: Uint8Array[]
}

export function commitUserMessage(
  messages: ConversationMessage[],
  pendingUserAudio: Uint8Array[],
  text: string,
): CommitUserResult {
  const finalized = finalizeAllOpenAssistants(messages)
  return {
    messages: [
      ...finalized,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        timestamp: Date.now(),
        audioChunks: pendingUserAudio,
        audioFinalized: true,
      },
    ],
    pendingUserAudio: [],
  }
}

/** 开新助手轮。可能返回与入参相同的引用（表示无变化）。 */
export function beginAssistantTurn(messages: ConversationMessage[]): ConversationMessage[] {
  const openAssistantIndex = findLatestOpenAssistantIndex(messages)
  if (openAssistantIndex !== -1 && openAssistantIndex === messages.length - 1) {
    return finalizeStaleOpenAssistants(messages)
  }
  const finalized = finalizeAllOpenAssistants(messages)
  return [...finalized, newAssistantMessage()]
}

export function appendAssistantText(messages: ConversationMessage[], text: string): ConversationMessage[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  if (last.role !== 'assistant' || last.audioFinalized) return messages
  const sep = last.text ? ' ' : ''
  const updated = { ...last, text: last.text + sep + text }
  return [...messages.slice(0, -1), updated]
}

export function appendAssistantAudio(messages: ConversationMessage[], chunk: Uint8Array): ConversationMessage[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  if (last.role !== 'assistant' || last.audioFinalized) return messages
  const updated = { ...last, audioChunks: [...last.audioChunks, chunk] }
  return [...messages.slice(0, -1), updated]
}

export function finalizeAssistantMessage(messages: ConversationMessage[]): ConversationMessage[] {
  return finalizeAllOpenAssistants(messages)
}
