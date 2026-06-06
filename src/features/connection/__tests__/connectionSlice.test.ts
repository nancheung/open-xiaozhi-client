import { describe, it, expect, beforeEach } from 'vitest'
import { createConnectionSlice, type ConnectionState } from '../connectionSlice'
import { createStore } from 'zustand/vanilla'
import { STORAGE_KEYS } from '../../../lib/persistence'

function makeStore() {
  return createStore<ConnectionState>()(createConnectionSlice)
}

describe('connectionSlice 状态机', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => { 
    localStorage.clear()
    store = makeStore() 
  })

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

describe('connectionSlice otaUrl 持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初始化时从 localStorage 加载 otaUrl', () => {
    localStorage.setItem(STORAGE_KEYS.OTA_URL, 'http://test-server:9000')
    const store = makeStore()
    expect(store.getState().config.otaUrl).toBe('http://test-server:9000')
  })

  it('updateConfig 更新 otaUrl 时写入 localStorage', () => {
    const store = makeStore()
    store.getState().updateConfig({ otaUrl: 'http://new-server:8080' })
    
    const saved = localStorage.getItem(STORAGE_KEYS.OTA_URL)
    expect(saved).toBe('http://new-server:8080')
    expect(store.getState().config.otaUrl).toBe('http://new-server:8080')
  })

  it('localStorage 为空时使用默认 otaUrl', () => {
    const store = makeStore()
    expect(store.getState().config.otaUrl).toBe('https://2662r3426b.vicp.fun/xiaozhi/ota/')
  })

  it('updateConfig 更新其他字段不影响 otaUrl 持久化', () => {
    localStorage.setItem(STORAGE_KEYS.OTA_URL, 'http://existing:8003')
    const store = makeStore()
    
    store.getState().updateConfig({ clientId: 'new-client-id' })
    
    const saved = localStorage.getItem(STORAGE_KEYS.OTA_URL)
    expect(saved).toBe('http://existing:8003')
  })
})
