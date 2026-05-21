import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientView } from '../ClientView'
import { useStore } from '../../store'

vi.mock('../../hooks/useConnection', () => ({
  useConnection: () => ({
    sendListen: vi.fn(),
    sendAbort: vi.fn(),
  }),
}))

vi.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    recordingAnalyserRef: { current: null },
    playbackAnalyserRef: { current: null },
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
      status: 'ready',
      audioError: null,
      audioContextSuspended: false,
    })
  })

  it('当存在激活状态时优先显示 activation.message', () => {
    useStore.setState({
      ttsText: '原始回复',
      activationPayload: { message: '需要激活' },
    })

    render(<ClientView />)

    expect(screen.getByText('需要激活')).toBeInTheDocument()
    expect(screen.queryByText('原始回复')).not.toBeInTheDocument()
  })

  it('当激活消息为空字符串时不回退到 ttsText', () => {
    useStore.setState({
      ttsText: '原始回复',
      activationPayload: { message: '' },
    })

    render(<ClientView />)

    expect(screen.queryByText('原始回复')).not.toBeInTheDocument()
    expect(screen.queryByText('等待回复...')).not.toBeInTheDocument()
  })

  it('当激活状态为空时继续显示原始 ttsText', () => {
    useStore.setState({
      ttsText: '原始回复',
      activationPayload: null,
    })

    render(<ClientView />)

    expect(screen.getByText('原始回复')).toBeInTheDocument()
  })

  it('当没有激活信息和 ttsText 时显示等待回复占位符', () => {
    render(<ClientView />)

    expect(screen.getByText('等待回复...')).toBeInTheDocument()
  })
})
