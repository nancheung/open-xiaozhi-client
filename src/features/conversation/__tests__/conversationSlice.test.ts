import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createConversationSlice, type ConversationState } from '../conversationSlice'

function makeStore() {
  return create<ConversationState>()((...args) => ({
    ...createConversationSlice(...args),
  }))
}

describe('conversationSlice', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    store = makeStore()
  })

  it('accumulates pending audio before STT arrives', () => {
    const chunk1 = new Uint8Array([1, 2])
    const chunk2 = new Uint8Array([3, 4])
    store.getState().appendPendingUserAudio(chunk1)
    store.getState().appendPendingUserAudio(chunk2)
    expect(store.getState().pendingUserAudio).toHaveLength(2)
    expect(store.getState().messages).toHaveLength(0)
  })

  it('commitUserMessage creates user message with pending audio and clears pending', () => {
    const chunk = new Uint8Array([1, 2, 3])
    store.getState().appendPendingUserAudio(chunk)
    store.getState().commitUserMessage('你好')
    const { messages, pendingUserAudio } = store.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].text).toBe('你好')
    expect(messages[0].audioChunks).toHaveLength(1)
    expect(messages[0].audioFinalized).toBe(true)
    expect(pendingUserAudio).toHaveLength(0)
  })

  it('startAssistantMessage creates unfinalized assistant message', () => {
    store.getState().startAssistantMessage('北京今天天气晴朗')
    const msg = store.getState().messages[0]
    expect(msg.role).toBe('assistant')
    expect(msg.text).toBe('北京今天天气晴朗')
    expect(msg.audioFinalized).toBe(false)
    expect(msg.audioChunks).toHaveLength(0)
  })

  it('appendAssistantAudio adds chunks to last assistant message', () => {
    store.getState().startAssistantMessage('回复')
    store.getState().appendAssistantAudio(new Uint8Array([10]))
    store.getState().appendAssistantAudio(new Uint8Array([20]))
    expect(store.getState().messages[0].audioChunks).toHaveLength(2)
  })

  it('appendAssistantAudio is no-op when last message is user', () => {
    store.getState().commitUserMessage('用户消息')
    store.getState().appendAssistantAudio(new Uint8Array([99]))
    expect(store.getState().messages[0].audioChunks).toHaveLength(0) // user audio unchanged
  })

  it('finalizeAssistantMessage marks last assistant message as finalized', () => {
    store.getState().startAssistantMessage('回复')
    store.getState().appendAssistantAudio(new Uint8Array([1]))
    store.getState().finalizeAssistantMessage()
    expect(store.getState().messages[0].audioFinalized).toBe(true)
  })

  it('clearConversation removes all messages and pending audio', () => {
    store.getState().appendPendingUserAudio(new Uint8Array([1]))
    store.getState().commitUserMessage('消息')
    store.getState().clearConversation()
    expect(store.getState().messages).toHaveLength(0)
    expect(store.getState().pendingUserAudio).toHaveLength(0)
  })
})
