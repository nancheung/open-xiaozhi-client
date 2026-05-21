import { describe, it, expect, beforeEach } from 'vitest'
import { createConnectionSlice, type ConnectionState } from '../connectionSlice'
import { createStore } from 'zustand/vanilla'

function makeStore() {
  return createStore<ConnectionState>()(createConnectionSlice)
}

describe('connectionSlice 状态机', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => { store = makeStore() })

  it('初始状态为 idle', () => {
    expect(store.getState().status).toBe('idle')
  })

  it('setStatus 正确切换状态', () => {
    store.getState().setStatus('ws_connecting')
    expect(store.getState().status).toBe('ws_connecting')
  })

  it('setSessionId 保存 session_id', () => {
    store.getState().setSessionId('abc-123')
    expect(store.getState().sessionId).toBe('abc-123')
  })

  it('setDownstreamSampleRate 保存采样率', () => {
    store.getState().setDownstreamSampleRate(24000)
    expect(store.getState().downstreamSampleRate).toBe(24000)
  })

  it('reset 清空连接信息并回到 idle', () => {
    store.getState().setSessionId('x')
    store.getState().setStatus('ready')
    store.getState().reset()
    expect(store.getState().status).toBe('idle')
    expect(store.getState().sessionId).toBeNull()
  })
})
