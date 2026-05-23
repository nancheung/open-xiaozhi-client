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

  it('commitUserMessage finalizes any open assistant turn before appending the user message', () => {
    store.getState().beginAssistantTurn()
    store.getState().appendAssistantText('上一段回复')

    store.getState().commitUserMessage('新的用户消息')

    const { messages } = store.getState()
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].text).toBe('上一段回复')
    expect(messages[0].audioFinalized).toBe(true)
    expect(messages[1].role).toBe('user')
    expect(messages[1].text).toBe('新的用户消息')
  })

  it('beginAssistantTurn opens an unfinalized assistant message that can receive text', () => {
    store.getState().beginAssistantTurn()
    store.getState().appendAssistantText('北京今天天气晴朗')
    const msg = store.getState().messages[0]
    expect(msg.role).toBe('assistant')
    expect(msg.text).toBe('北京今天天气晴朗')
    expect(msg.audioFinalized).toBe(false)
    expect(msg.audioChunks).toHaveLength(0)
  })

  it('appendAssistantAudio adds chunks to last assistant message', () => {
    store.getState().beginAssistantTurn()
    store.getState().appendAssistantText('回复')
    store.getState().appendAssistantAudio(new Uint8Array([10]))
    store.getState().appendAssistantAudio(new Uint8Array([20]))
    expect(store.getState().messages[0].audioChunks).toHaveLength(2)
  })

  it('appendAssistantAudio is no-op when last message is user', () => {
    store.getState().commitUserMessage('用户消息')
    store.getState().appendAssistantAudio(new Uint8Array([99]))
    expect(store.getState().messages[0].audioChunks).toHaveLength(0) // user audio unchanged
  })

  it('finalizeAssistantMessage marks all open assistant messages as finalized', () => {
    store.setState({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: '第一段回复',
          timestamp: 1,
          audioChunks: [],
          audioFinalized: false,
        },
        {
          id: 'user-1',
          role: 'user',
          text: '用户消息',
          timestamp: 2,
          audioChunks: [],
          audioFinalized: true,
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          text: '第二段回复',
          timestamp: 3,
          audioChunks: [new Uint8Array([1])],
          audioFinalized: false,
        },
      ],
    })

    store.getState().appendAssistantAudio(new Uint8Array([1]))
    store.getState().finalizeAssistantMessage()
    const assistantMessages = store.getState().messages.filter(message => message.role === 'assistant')
    expect(assistantMessages).toHaveLength(2)
    expect(assistantMessages.every(message => message.audioFinalized)).toBe(true)
  })

  it('finalizeAssistantMessage removes an empty open assistant message with no text or audio', () => {
    store.getState().beginAssistantTurn()

    store.getState().finalizeAssistantMessage()

    expect(store.getState().messages).toHaveLength(0)
  })

  it('finalizeAssistantMessage preserves an audio-only assistant message', () => {
    store.getState().beginAssistantTurn()
    store.getState().appendAssistantAudio(new Uint8Array([1]))

    store.getState().finalizeAssistantMessage()

    const { messages } = store.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].text).toBe('')
    expect(messages[0].audioChunks).toHaveLength(1)
    expect(messages[0].audioFinalized).toBe(true)
  })

  it('commitUserMessage finalizes every stale open assistant message before appending the user message', () => {
    store.setState({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: '第一段回复',
          timestamp: 1,
          audioChunks: [],
          audioFinalized: false,
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          text: '第二段回复',
          timestamp: 2,
          audioChunks: [],
          audioFinalized: false,
        },
      ],
    })

    store.getState().commitUserMessage('新的用户消息')

    const { messages } = store.getState()
    expect(messages).toHaveLength(3)
    expect(messages[0].audioFinalized).toBe(true)
    expect(messages[1].audioFinalized).toBe(true)
    expect(messages[2].role).toBe('user')
    expect(messages[2].text).toBe('新的用户消息')
  })

  it('clearConversation removes all messages and pending audio', () => {
    store.getState().appendPendingUserAudio(new Uint8Array([1]))
    store.getState().commitUserMessage('消息')
    store.getState().clearConversation()
    expect(store.getState().messages).toHaveLength(0)
    expect(store.getState().pendingUserAudio).toHaveLength(0)
  })

  it('beginAssistantTurn creates only one open assistant message until finalized', () => {
    store.getState().beginAssistantTurn()
    store.getState().beginAssistantTurn()
    expect(store.getState().messages).toHaveLength(1)
    expect(store.getState().messages[0].role).toBe('assistant')
    expect(store.getState().messages[0].audioFinalized).toBe(false)

    store.getState().appendAssistantText('第一段回复')
    store.getState().finalizeAssistantMessage()
    store.getState().beginAssistantTurn()
    expect(store.getState().messages).toHaveLength(2)
  })
})
