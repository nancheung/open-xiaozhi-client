import { describe, it, expect, beforeEach } from 'vitest'
import { createSettingsSlice, type SettingsState } from '../settingsSlice'
import { createStore } from 'zustand/vanilla'
import { STORAGE_KEYS } from '../../../lib/persistence'

function makeStore() {
  return createStore<SettingsState>()(createSettingsSlice)
}

describe('settingsSlice 持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初始化时从 localStorage 加载设置', () => {
    const savedSettings = {
      helloVersion: 2,
      helloFeatures: { mcp: false, emoji: true },
      helloAudio: { format: 'opus', sample_rate: 24000, channels: 2, frame_duration: 20 },
      handshakeTimeoutMs: 5000,
      heartbeatIntervalMs: 3000,
      maxLogEntries: 1000,
      mergeBinaryFrames: false,
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(savedSettings))

    const store = makeStore()
    const state = store.getState()

    expect(state.helloVersion).toBe(2)
    expect(state.helloFeatures).toEqual({ mcp: false, emoji: true })
    expect(state.helloAudio).toEqual({ format: 'opus', sample_rate: 24000, channels: 2, frame_duration: 20 })
    expect(state.handshakeTimeoutMs).toBe(5000)
    expect(state.heartbeatIntervalMs).toBe(3000)
    expect(state.maxLogEntries).toBe(1000)
    expect(state.mergeBinaryFrames).toBe(false)
  })

  it('updateHelloFeatures 写入 localStorage', () => {
    const store = makeStore()
    store.getState().updateHelloFeatures({ mcp: false })

    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed.helloFeatures.mcp).toBe(false)
  })

  it('updateHelloAudio 写入 localStorage', () => {
    const store = makeStore()
    store.getState().updateHelloAudio({ sample_rate: 48000 })

    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed.helloAudio.sample_rate).toBe(48000)
  })

  it('updateSettings 写入 localStorage', () => {
    const store = makeStore()
    store.getState().updateSettings({ maxLogEntries: 2000 })

    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed.maxLogEntries).toBe(2000)
  })

  it('localStorage 为空时使用默认值', () => {
    const store = makeStore()
    const state = store.getState()

    expect(state.helloVersion).toBe(3)
    expect(state.helloFeatures).toEqual({ mcp: true, emoji: true })
    expect(state.maxLogEntries).toBe(500)
  })
})
