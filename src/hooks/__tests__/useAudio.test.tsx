import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAudio } from '../useAudio'
import { useStore } from '../../store'

// useAudio 通过这些模块完成录音/上行，测试中全部 mock 为 no-op，
// 聚焦于「连接关闭后是否还会接线麦克风」这一行为。
vi.mock('../../ws/wsManager', () => ({ sendBinary: vi.fn() }))
vi.mock('../../features/audio/opusEncoder', () => ({
  encodeFloat32ToOpus: vi.fn(() => new Uint8Array()),
  disposeEncoder: vi.fn(),
}))
vi.mock('../../features/audio/opusDecoder', () => ({ decodeOpusToFloat32: vi.fn() }))
vi.mock('../../features/mcp/audioControl', () => ({ registerGainNode: vi.fn() }))

// 可手动 resolve 的 getUserMedia，用来在 await 期间制造「连接关闭」竞态窗口
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('useAudio 录音竞态', () => {
  const trackStop = vi.fn()
  const fakeStream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream
  const getUserMedia = vi.fn()
  // 若取消失败、startRecording 继续执行，会构造 AudioContext —— 用它作为「泄漏」探针
  const AudioContextSpy = vi.fn()

  beforeEach(() => {
    trackStop.mockClear()
    getUserMedia.mockReset()
    AudioContextSpy.mockClear()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal('AudioContext', AudioContextSpy)
    useStore.setState({ audioStatus: 'idle' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('连接关闭（audioStatus → idle）时，in-flight 的 startRecording 不再接线麦克风', async () => {
    const d = deferred<MediaStream>()
    getUserMedia.mockReturnValue(d.promise)

    renderHook(() => useAudio())

    // 进入聆听：触发 startRecording()，此刻卡在 await getUserMedia
    act(() => { useStore.setState({ audioStatus: 'recording' }) })
    expect(getUserMedia).toHaveBeenCalledTimes(1)

    // 服务器关闭连接 → teardown → resetAudio 把 audioStatus 置 idle → stopRecording()
    act(() => { useStore.setState({ audioStatus: 'idle' }) })

    // getUserMedia 现在才 resolve（竞态窗口结束）
    await act(async () => { d.resolve(fakeStream) })

    // 刚获取的麦克风轨道被释放，且从未继续构造音频图（AudioContext 未被创建）
    expect(trackStop).toHaveBeenCalledTimes(1)
    expect(AudioContextSpy).not.toHaveBeenCalled()
  })
})
