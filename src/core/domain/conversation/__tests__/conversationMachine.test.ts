import { describe, it, expect } from 'vitest'
import { MachineRunner } from '../../../fsm/defineMachine'
import { createConversationMachine } from '../conversationMachine'
import type { TurnEffect, TurnEvent, TurnContext } from '../conversationTypes'

function runner(mode: TurnContext['mode']) {
  const fx: TurnEffect[] = []
  const r = new MachineRunner(createConversationMachine(mode), (f) => fx.push(f))
  return { r, fx, send: (e: TurnEvent) => { fx.length = 0; r.send(e) } }
}

const tags = (fx: TurnEffect[]) => fx.map(f => {
  if (f.kind === 'emit') return `emit:${f.event.type}`
  if (f.kind === 'sendListen') return `listen:${f.state}${f.mode ? ':' + f.mode : ''}`
  if (f.kind === 'sendAbort') return 'abort'
  return f.kind
})

describe('conversationMachine — 监听模式与 TTS 编排', () => {
  it('auto + 录音中：TTS_START 停麦并标记自动重启，TTS_STOP 自动重启录音', () => {
    const { r, send, fx } = runner('auto')
    send({ type: 'MIC_PRESS' })
    expect(r.state).toBe('listening')
    expect(tags(fx)).toEqual(expect.arrayContaining(['listen:start:auto', 'startMic']))

    send({ type: 'TTS_START' })
    expect(r.state).toBe('speaking')
    expect(r.context.autoRestart).toBe(true)
    expect(tags(fx)).toContain('stopMic')

    send({ type: 'TTS_STOP' })
    expect(r.state).toBe('listening')
    expect(r.context.autoRestart).toBe(false)
    expect(tags(fx)).toEqual(expect.arrayContaining(['emit:TtsStopped', 'listen:start:auto', 'startMic']))
  })

  it('auto + 未录音（服务器问候）：TTS_START 不标记重启，TTS_STOP 回 idle', () => {
    const { r, send } = runner('auto')
    send({ type: 'TTS_START' })       // 从 idle
    expect(r.state).toBe('speaking')
    expect(r.context.autoRestart).toBe(false)
    send({ type: 'TTS_STOP' })
    expect(r.state).toBe('idle')
  })

  it('manual：TTS 结束回 idle，不自动重启', () => {
    const { r, send } = runner('manual')
    send({ type: 'MIC_PRESS' })
    send({ type: 'TTS_START' })
    expect(r.context.autoRestart).toBe(false)
    send({ type: 'TTS_STOP' })
    expect(r.state).toBe('idle')
  })

  it('TTS 播放中按麦克风：打断并开始新录音', () => {
    const { r, send, fx } = runner('manual')
    send({ type: 'MIC_PRESS' })
    send({ type: 'TTS_START' })
    expect(r.state).toBe('speaking')
    send({ type: 'MIC_PRESS' })
    expect(r.state).toBe('listening')
    expect(tags(fx)).toEqual(expect.arrayContaining(['abort', 'listen:start:manual', 'startMic']))
  })

  it('TTS 播放中按中断：回 idle 并 abort（自动重启被取消）', () => {
    const { r, send, fx } = runner('auto')
    send({ type: 'MIC_PRESS' })
    send({ type: 'TTS_START' })
    expect(r.context.autoRestart).toBe(true)
    send({ type: 'ABORT_PRESS' })
    expect(r.state).toBe('idle')
    expect(tags(fx)).toEqual(expect.arrayContaining(['abort', 'stopMic']))
    // 已离开 speaking，后续 TTS_STOP 不会触发自动重启
    send({ type: 'TTS_STOP' })
    expect(r.state).toBe('idle')
  })

  it('realtime：全双工保持麦克风，TTS_STOP 无缝回 listening', () => {
    const { r, send, fx } = runner('realtime')
    send({ type: 'MIC_PRESS' })
    expect(tags(fx)).toContain('listen:start:realtime')
    send({ type: 'TTS_START' })
    expect(r.state).toBe('fullDuplex')
    expect(tags(fx)).not.toContain('stopMic')   // 全双工不停麦
    send({ type: 'TTS_STOP' })
    expect(r.state).toBe('listening')
    expect(tags(fx)).not.toContain('startMic')   // 麦克风保持，不重新开
  })

  it('realtime 全双工按麦克风：中止', () => {
    const { r, send, fx } = runner('realtime')
    send({ type: 'MIC_PRESS' })
    send({ type: 'TTS_START' })
    expect(r.state).toBe('fullDuplex')
    send({ type: 'MIC_PRESS' })
    expect(r.state).toBe('idle')
    expect(tags(fx)).toEqual(expect.arrayContaining(['abort', 'stopMic']))
  })

  it('STT 内部工具(% 前缀)：发 SttReceived(internalTool) 但不计耗时', () => {
    const { send, fx } = runner('auto')
    send({ type: 'STT', text: '%调用工具', internalTool: true })
    const t = tags(fx)
    expect(t).toContain('emit:SttReceived')
    expect(t).not.toContain('emit:MarkStt')
  })

  it('STT 真实用户：发 SttReceived 且计耗时', () => {
    const { send, fx } = runner('auto')
    send({ type: 'STT', text: '今天天气', internalTool: false })
    const t = tags(fx)
    expect(t).toContain('emit:SttReceived')
    expect(t).toContain('emit:MarkStt')
  })

  it('SESSION_LOST：停麦回 idle', () => {
    const { r, send, fx } = runner('manual')
    send({ type: 'MIC_PRESS' })
    send({ type: 'SESSION_LOST' })
    expect(r.state).toBe('idle')
    expect(tags(fx)).toContain('stopMic')
  })

  it('SET_MODE：更新模式并发 ListenModeChanged', () => {
    const { r, send, fx } = runner('auto')
    send({ type: 'SET_MODE', mode: 'realtime' })
    expect(r.context.mode).toBe('realtime')
    expect(tags(fx)).toContain('emit:ListenModeChanged')
  })
})
