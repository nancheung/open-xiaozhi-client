// 会话/轮次的显式状态机。
// 集中编码三种监听模式（对讲机 manual / 智能助理 auto / 通话 realtime）、TTS 播放、
// 自动重启、打断与全双工——取代原先散落在 wsManager TTS 处理、useAudio 录音 effect、
// 以及 ClientView.handleMicClick 里的隐式逻辑。
//
// 派生关系（供只读视图模型）：
//   recording = state ∈ {listening, fullDuplex}
//   playing   = state ∈ {speaking, fullDuplex}（等价 ttsActive）

import type { MachineDef } from '../../fsm/types'
import type { DomainEvent } from '../../events/domainEvents'
import type {
  TurnContext, TurnEffect, TurnEvent, TurnState,
} from './conversationTypes'

const emit = (event: DomainEvent): TurnEffect => ({ kind: 'emit', event })

const turnState = (recording: boolean, playing: boolean, ttsActive: boolean): TurnEffect =>
  emit({ type: 'TurnStateChanged', recording, playing, ttsActive })

// TTS 开始时的共享 effects（进入说话/全双工前）
const ttsStartEffects: TurnEffect[] = [
  emit({ type: 'MarkServerEnter' }),
  emit({ type: 'TtsStarted' }),
]

// STT 到达：投影层据 internalTool 决定是否重开助手轮；非内部工具才计入耗时
const sttEffects = (_: TurnContext, ev: TurnEvent): TurnEffect[] => {
  if (ev.type !== 'STT') return []
  const fx: TurnEffect[] = [emit({ type: 'SttReceived', text: ev.text, internalTool: ev.internalTool })]
  if (!ev.internalTool) fx.push(emit({ type: 'MarkStt' }))
  return fx
}

const setMode = (_: TurnContext, ev: TurnEvent): Partial<TurnContext> =>
  ev.type === 'SET_MODE' ? { mode: ev.mode } : {}
const setModeEffects = (_: TurnContext, ev: TurnEvent): TurnEffect[] =>
  ev.type === 'SET_MODE' ? [emit({ type: 'ListenModeChanged', mode: ev.mode })] : []

const isRealtime = (ctx: TurnContext): boolean => ctx.mode === 'realtime'

export function createConversationMachine(initialMode: TurnContext['mode']): MachineDef<TurnState, TurnContext, TurnEvent, TurnEffect> {
  return {
    initial: 'idle',
    context: { mode: initialMode, autoRestart: false, ttsActive: false },
    states: {
      idle: {
        entry: () => [turnState(false, false, false)],
        on: {
          MIC_PRESS: {
            target: 'listening',
            effects: (ctx) => [
              ...(ctx.ttsActive ? [{ kind: 'sendAbort' } as TurnEffect] : []),
              { kind: 'sendListen', state: 'start', mode: ctx.mode },
              { kind: 'startMic' },
            ],
          },
          SET_MODE: { assign: setMode, effects: setModeEffects },
          STT: { effects: sttEffects },
          TTS_START: [
            { guard: isRealtime, target: 'fullDuplex', assign: () => ({ ttsActive: true, autoRestart: false }), effects: () => ttsStartEffects },
            { target: 'speaking', assign: () => ({ ttsActive: true, autoRestart: false }), effects: () => ttsStartEffects },
          ],
          TTS_STOP: { effects: () => [emit({ type: 'TtsStopped' })] },
          SESSION_LOST: { effects: () => [{ kind: 'stopMic' }] },
        },
      },

      listening: {
        entry: () => [turnState(true, false, false)],
        on: {
          MIC_PRESS: {
            target: 'idle',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: (ctx) => isRealtime(ctx)
              ? [{ kind: 'sendAbort' }, { kind: 'stopMic' }]
              : [{ kind: 'sendListen', state: 'stop' }, { kind: 'stopMic' }],
          },
          ABORT_PRESS: {
            target: 'idle',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: (_, ev) => [{ kind: 'sendAbort', reason: ev.type === 'ABORT_PRESS' ? ev.reason : undefined }, { kind: 'stopMic' }],
          },
          STT: { effects: sttEffects },
          TTS_START: [
            { guard: isRealtime, target: 'fullDuplex', assign: () => ({ ttsActive: true, autoRestart: false }), effects: () => ttsStartEffects },
            {
              target: 'speaking',
              assign: (ctx) => ({ ttsActive: true, autoRestart: ctx.mode === 'auto' }),
              effects: () => [{ kind: 'stopMic' }, ...ttsStartEffects],
            },
          ],
          TTS_STOP: { effects: () => [emit({ type: 'TtsStopped' })] },
          SET_MODE: { assign: setMode, effects: setModeEffects },
          // 麦克风初始化失败：回 idle 但不发 listen stop（对齐原 setAudioStatus('idle')）
          MIC_FAILED: { target: 'idle', assign: () => ({ ttsActive: false, autoRestart: false }), effects: () => [{ kind: 'stopMic' }] },
          SESSION_LOST: { target: 'idle', assign: () => ({ ttsActive: false, autoRestart: false }), effects: () => [{ kind: 'stopMic' }] },
        },
      },

      speaking: {
        entry: () => [turnState(false, true, true)],
        on: {
          // TTS 中按麦克风：打断当前 TTS 并开始新一轮录音（对齐原 handleMicClick else 分支）
          MIC_PRESS: {
            target: 'listening',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: (ctx) => [{ kind: 'sendAbort' }, { kind: 'sendListen', state: 'start', mode: ctx.mode }, { kind: 'startMic' }],
          },
          ABORT_PRESS: {
            target: 'idle',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: (_, ev) => [{ kind: 'sendAbort', reason: ev.type === 'ABORT_PRESS' ? ev.reason : undefined }, { kind: 'stopMic' }],
          },
          STT: { effects: sttEffects },
          TTS_STOP: [
            {
              guard: (ctx) => ctx.autoRestart,
              target: 'listening',
              assign: () => ({ autoRestart: false, ttsActive: false }),
              effects: () => [emit({ type: 'TtsStopped' }), { kind: 'sendListen', state: 'start', mode: 'auto' }, { kind: 'startMic' }],
            },
            {
              target: 'idle',
              assign: () => ({ ttsActive: false }),
              effects: () => [emit({ type: 'TtsStopped' })],
            },
          ],
          // 连续 tts.start：保持说话态
          TTS_START: { assign: () => ({ ttsActive: true }) },
          SET_MODE: { assign: setMode, effects: setModeEffects },
          SESSION_LOST: { target: 'idle', assign: () => ({ ttsActive: false, autoRestart: false }), effects: () => [{ kind: 'stopMic' }] },
        },
      },

      fullDuplex: {
        entry: () => [turnState(true, true, true)],
        on: {
          // 实时模式录音中按麦克风：中止（对齐原 isRecording && realtime → sendAbort）
          MIC_PRESS: {
            target: 'idle',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: () => [{ kind: 'sendAbort' }, { kind: 'stopMic' }],
          },
          ABORT_PRESS: {
            target: 'idle',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: (_, ev) => [{ kind: 'sendAbort', reason: ev.type === 'ABORT_PRESS' ? ev.reason : undefined }, { kind: 'stopMic' }],
          },
          STT: { effects: sttEffects },
          // 全双工 TTS 结束：麦克风保持，回到 listening，无缝下一轮
          TTS_STOP: {
            target: 'listening',
            assign: () => ({ ttsActive: false, autoRestart: false }),
            effects: () => [emit({ type: 'TtsStopped' })],
          },
          TTS_START: { assign: () => ({ ttsActive: true }) },
          SET_MODE: { assign: setMode, effects: setModeEffects },
          MIC_FAILED: { target: 'idle', assign: () => ({ ttsActive: false, autoRestart: false }), effects: () => [{ kind: 'stopMic' }] },
          SESSION_LOST: { target: 'idle', assign: () => ({ ttsActive: false, autoRestart: false }), effects: () => [{ kind: 'stopMic' }] },
        },
      },
    },
  }
}
