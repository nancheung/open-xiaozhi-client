import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { create } from 'zustand'
import { createLatencySlice, type LatencyState } from '../latencySlice'

function makeStore() {
  return create<LatencyState>()((...args) => createLatencySlice(...args))
}

describe('latencySlice 分轮与时间点', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    store = makeStore()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const s = () => store.getState()
  const last = () => s().turns[s().turns.length - 1]

  it('正常手动轮：start→stop→stt→enter→speak 填满单轮且首次胜', () => {
    s().markUserStart()       // t=0
    vi.setSystemTime(1000)
    s().markUserStop()        // t=1000
    vi.setSystemTime(1200)
    s().markStt()             // t=1200, userStop 已存在不覆盖
    vi.setSystemTime(1500)
    s().markServerEnter()     // t=1500
    vi.setSystemTime(1700)
    s().markServerSpeak()     // t=1700

    expect(s().turns).toHaveLength(1)
    const t = last()
    expect(t.userStartAt).toBe(0)
    expect(t.userStopAt).toBe(1000)      // 来自 markUserStop，未被 stt 覆盖
    expect(t.sttAt).toBe(1200)
    expect(t.serverEnterAt).toBe(1500)
    expect(t.serverSpeakAt).toBe(1700)
  })

  it('自动/实时回退：无 listen stop 时 userStopAt 回退为 sttAt', () => {
    s().markUserStart()
    vi.setSystemTime(900)
    s().markStt()             // 无 markUserStop
    const t = last()
    expect(t.sttAt).toBe(900)
    expect(t.userStopAt).toBe(900)
  })

  it('实时第 2 轮：无 markUserStart 时 STT 自行开新轮', () => {
    // 第 1 轮完整
    s().markUserStart()
    s().markStt()
    s().markServerEnter()
    s().markServerSpeak()
    expect(s().turns).toHaveLength(1)

    // 第 2 轮：实时模式不再发 listen start，直接来 STT
    vi.setSystemTime(5000)
    s().markStt()
    expect(s().turns).toHaveLength(2)
    expect(last().userStartAt).toBeNull()
    expect(last().sttAt).toBe(5000)
    expect(last().userStopAt).toBe(5000)
  })

  it('服务器问候：空 turns 下 markServerEnter 开新轮且无用户信号', () => {
    vi.setSystemTime(300)
    s().markServerEnter()
    expect(s().turns).toHaveLength(1)
    const t = last()
    expect(t.userStartAt).toBeNull()
    expect(t.userStopAt).toBeNull()
    expect(t.sttAt).toBeNull()
    expect(t.serverEnterAt).toBe(300)
  })

  it('markServerSpeak 每帧调用：仅首帧记录，后续帧不新开轮也不覆盖', () => {
    s().markUserStart()
    s().markServerEnter()
    vi.setSystemTime(2000)
    s().markServerSpeak()     // 首帧
    vi.setSystemTime(2050)
    s().markServerSpeak()     // 后续帧
    vi.setSystemTime(2100)
    s().markServerSpeak()     // 后续帧

    expect(s().turns).toHaveLength(1)
    expect(last().serverSpeakAt).toBe(2000)
  })

  it('markServerEnter 在已完成轮之后开新轮', () => {
    s().markUserStart()
    s().markServerEnter()
    s().markServerSpeak()     // 轮 1 完成
    vi.setSystemTime(4000)
    s().markServerEnter()     // 轮 2
    expect(s().turns).toHaveLength(2)
    expect(last().serverEnterAt).toBe(4000)
    expect(last().serverSpeakAt).toBeNull()
  })

  it('markUserStart 总是开新轮（即使上一轮未完成）', () => {
    s().markUserStart()       // 轮 1，用户中途放弃
    s().markUserStart()       // 轮 2
    expect(s().turns).toHaveLength(2)
  })

  it('clearLatency 清空', () => {
    s().markUserStart()
    s().markServerSpeak()
    s().clearLatency()
    expect(s().turns).toHaveLength(0)
  })

  it('容量上限裁剪到 50 轮', () => {
    for (let i = 0; i < 60; i++) {
      s().markUserStart()
      s().markServerSpeak()
    }
    expect(s().turns).toHaveLength(50)
  })
})
