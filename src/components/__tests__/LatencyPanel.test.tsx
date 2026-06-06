import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LatencyPanel } from '../LatencyPanel'
import { useStore } from '../../store'
import type { TurnTiming } from '../../features/latency/latencySlice'

function turn(id: number, p: Partial<TurnTiming>): TurnTiming {
  return { id, userStartAt: null, userStopAt: null, sttAt: null, serverEnterAt: null, serverSpeakAt: null, ...p }
}

// 用户等待 = serverSpeakAt - userStopAt
const normalTurn = (id: number, base: number, wait: number, rec: number) =>
  turn(id, {
    userStartAt: base - rec - wait,
    userStopAt: base - wait,
    sttAt: base - wait,
    serverEnterAt: base - Math.round(wait / 2),
    serverSpeakAt: base,
  })

describe('LatencyPanel', () => {
  beforeEach(() => {
    useStore.setState({ turns: [] })
  })

  it('空态显示占位文案', () => {
    render(<LatencyPanel />)
    expect(screen.getByText('暂无数据，对话后将显示耗时')).toBeInTheDocument()
  })

  it('列表模式展示最新轮核心等待与各延迟', () => {
    const base = 1_000_000
    useStore.setState({ turns: [normalTurn(1, base, 412, 1000)] })
    render(<LatencyPanel />)

    expect(screen.getByText('用户说完话 → 服务器开始说话')).toBeInTheDocument()
    expect(screen.getByText('412ms')).toBeInTheDocument()   // userWait
    expect(screen.getByText('1.00s')).toBeInTheDocument()   // 录音时长 ≥1s → s
  })

  it('缺失时间点渲染 —（问候轮无用户等待）', () => {
    useStore.setState({ turns: [turn(1, { serverEnterAt: 500, serverSpeakAt: 670 })] })
    render(<LatencyPanel />)
    // 核心等待与录音时长均无值
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('清空按钮调用 clearLatency', () => {
    useStore.setState({ turns: [normalTurn(1, 1_000_000, 300, 800)] })
    render(<LatencyPanel />)
    fireEvent.click(screen.getByText('清空'))
    expect(useStore.getState().turns).toHaveLength(0)
  })

  it('切换图表模式渲染 SVG，节点数 = 有用户等待的轮数', () => {
    const base = 2_000_000
    useStore.setState({
      turns: [
        normalTurn(1, base - 9000, 400, 1500),
        turn(2, { serverEnterAt: base - 5170, serverSpeakAt: base - 5000 }), // 问候轮，跳过
        normalTurn(3, base, 520, 2000),
      ],
    })
    const { container } = render(<LatencyPanel />)
    fireEvent.click(screen.getByText('图表'))

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // 每个数据节点有一个透明命中圆 + 一个可视圆；命中圆数量 = 数据点数
    const hitCircles = container.querySelectorAll('circle[fill="transparent"]')
    expect(hitCircles).toHaveLength(2)
    // 统计条均值（(400+520)/2 = 460）
    expect(screen.getByText('460ms')).toBeInTheDocument()
  })
})
