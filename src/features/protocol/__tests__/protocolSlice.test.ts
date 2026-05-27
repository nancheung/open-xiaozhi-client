import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createProtocolSlice, type ProtocolState } from '../protocolSlice'

function makeStore(overrides: Partial<{ maxLogEntries: number; mergeBinaryFrames: boolean }> = {}) {
  const { maxLogEntries = 500, mergeBinaryFrames = true } = overrides
  return create<ProtocolState & { maxLogEntries: number; mergeBinaryFrames: boolean }>()(
    (...args) => ({
      maxLogEntries,
      mergeBinaryFrames,
      ...createProtocolSlice(...args),
    }),
  )
}

const chunk = (size: number) => new Uint8Array(size).fill(1)

describe('protocolSlice.addBinaryLog', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    store = makeStore()
  })

  it('单方向连续帧合并为一条记录', () => {
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-in', chunk(200))
    store.getState().addBinaryLog('binary-in', chunk(50))
    const { log } = store.getState()
    expect(log).toHaveLength(1)
    expect(log[0].frameCount).toBe(3)
    expect(log[0].totalBytes).toBe(350)
    expect(log[0].direction).toBe('binary-in')
  })

  it('实时模式：上传下载交替时各自独立合并', () => {
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-out', chunk(80))
    store.getState().addBinaryLog('binary-in', chunk(120))
    store.getState().addBinaryLog('binary-out', chunk(90))
    store.getState().addBinaryLog('binary-in', chunk(110))

    const { log } = store.getState()
    expect(log).toHaveLength(2)

    const inEntry = log.find(e => e.direction === 'binary-in')!
    const outEntry = log.find(e => e.direction === 'binary-out')!

    expect(inEntry.frameCount).toBe(3)
    expect(inEntry.totalBytes).toBe(330)
    expect(outEntry.frameCount).toBe(2)
    expect(outEntry.totalBytes).toBe(170)
  })

  it('文本消息打断后开始新的合并组', () => {
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-in', chunk(100))
    // 文本消息打断
    store.getState().addLog('in', { type: 'tts', state: 'stop' })
    store.getState().addBinaryLog('binary-in', chunk(50))

    const { log } = store.getState()
    expect(log).toHaveLength(3)
    expect(log[0].frameCount).toBe(2)  // 第一组：2帧合并
    expect(log[1].direction).toBe('in')
    expect(log[2].frameCount).toBe(1)  // 第二组：新建
  })

  it('out 消息也能打断合并', () => {
    store.getState().addBinaryLog('binary-out', chunk(80))
    store.getState().addLog('out', { type: 'listen', state: 'stop' })
    store.getState().addBinaryLog('binary-out', chunk(60))

    const { log } = store.getState()
    expect(log).toHaveLength(3)
    expect(log[0].frameCount).toBe(1)
    expect(log[2].frameCount).toBe(1)
  })

  it('禁用 mergeBinaryFrames 时每帧独立条目', () => {
    store = makeStore({ mergeBinaryFrames: false })
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-out', chunk(80))

    const { log } = store.getState()
    expect(log).toHaveLength(3)
    log.forEach(e => expect(e.frameCount).toBe(1))
  })

  it('合并条目包含完整的 audioChunks', () => {
    const c1 = chunk(10)
    const c2 = chunk(20)
    const c3 = chunk(30)
    store.getState().addBinaryLog('binary-in', c1)
    store.getState().addBinaryLog('binary-out', chunk(5))
    store.getState().addBinaryLog('binary-in', c2)
    store.getState().addBinaryLog('binary-in', c3)

    const inEntry = store.getState().log.find(e => e.direction === 'binary-in')!
    expect(inEntry.audioChunks).toHaveLength(3)
    expect(inEntry.audioChunks![0]).toBe(c1)
    expect(inEntry.audioChunks![1]).toBe(c2)
    expect(inEntry.audioChunks![2]).toBe(c3)
  })

  it('data 字段反映最新合并状态', () => {
    store.getState().addBinaryLog('binary-in', chunk(100))
    store.getState().addBinaryLog('binary-out', chunk(80))
    store.getState().addBinaryLog('binary-in', chunk(200))

    const inEntry = store.getState().log.find(e => e.direction === 'binary-in')!
    expect(inEntry.data).toBe('[2 frames, 300 bytes]')
  })
})
