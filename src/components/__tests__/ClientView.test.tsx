import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientView } from '../ClientView'
import { useStore } from '../../store'

// 新架构：UI 通过 dispatch 与 runtime 交互，音频可视化经 useAudioAnalysers。
vi.mock('../../ui/runtime/RuntimeContext', () => ({
  useDispatch: () => vi.fn(),
}))
vi.mock('../../ui/hooks/useAudioAnalysers', () => ({
  useAudioAnalysers: () => ({
    recordingAnalyser: null,
    playbackAnalyser: null,
    resumeAudioContext: vi.fn(),
  }),
}))

describe('ClientView AI 回复显示', () => {
  beforeEach(() => {
    useStore.setState({
      emotionEmoji: '🙂',
      emotion: 'neutral',
      sttText: '',
      ttsText: '',
      activationPayload: null,
      audioStatus: 'idle',
      listenMode: 'auto',
      isTTSActive: true,        // 进入“正在回复”态，使字幕/激活信息渲染
      status: 'ready',
      audioError: null,
      audioContextSuspended: false,
    })
  })

  it('当存在激活状态时优先显示 activation.message', () => {
    useStore.setState({ ttsText: '原始回复', activationPayload: { message: '需要激活' } })
    render(<ClientView />)
    // 激活信息可能同时出现在激活横幅与字幕条
    expect(screen.getAllByText('需要激活').length).toBeGreaterThan(0)
    expect(screen.queryByText('原始回复')).not.toBeInTheDocument()
  })

  it('当激活消息为空字符串时不回退到 ttsText', () => {
    useStore.setState({ ttsText: '原始回复', activationPayload: { message: '' } })
    render(<ClientView />)
    expect(screen.queryByText('原始回复')).not.toBeInTheDocument()
    expect(screen.queryByText(/正在回复/)).not.toBeInTheDocument()
  })

  it('当激活状态为空时继续显示原始 ttsText', () => {
    useStore.setState({ ttsText: '原始回复', activationPayload: null })
    render(<ClientView />)
    expect(screen.getByText('原始回复')).toBeInTheDocument()
  })

  it('当没有激活信息和 ttsText 时显示正在回复占位符', () => {
    render(<ClientView />)
    expect(screen.getByText(/正在回复/)).toBeInTheDocument()
  })
})
