import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store'
import { useConnection } from '../useConnection'

const { connectMock, disconnectMock, sendJsonMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
  sendJsonMock: vi.fn(),
}))

vi.mock('../../ws/wsManager', () => ({
  connect: connectMock,
  disconnect: disconnectMock,
  sendJson: sendJsonMock,
}))

describe('useConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.getState().clearConversation()
    useStore.setState({
      sessionId: 'session-1',
      status: 'ready',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: '更早的未完成回复',
          timestamp: Date.now(),
          audioChunks: [],
          audioFinalized: false,
        },
        {
          id: 'user-1',
          role: 'user',
          text: '用户消息',
          timestamp: Date.now(),
          audioChunks: [],
          audioFinalized: true,
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          text: '当前未完成回复',
          timestamp: Date.now(),
          audioChunks: [],
          audioFinalized: false,
        },
      ],
    })
  })

  it('sendAbort leaves every interrupted assistant turn finalized', () => {
    const { result } = renderHook(() => useConnection())

    act(() => {
      result.current.sendAbort()
    })

    expect(sendJsonMock).toHaveBeenCalledWith({ type: 'abort', session_id: 'session-1' })
    expect(
      useStore.getState().messages
        .filter(message => message.role === 'assistant')
        .every(message => message.audioFinalized),
    ).toBe(true)
  })
})
