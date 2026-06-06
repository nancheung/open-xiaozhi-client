import { describe, it, expect } from 'vitest'
import { transition, MachineRunner } from '../defineMachine'
import type { MachineDef } from '../types'

type S = 'a' | 'b'
type C = { count: number }
type E = { type: 'GO' } | { type: 'INC' } | { type: 'NOPE' }
type F = { kind: 'fx'; tag: string }

const def: MachineDef<S, C, E, F> = {
  initial: 'a',
  context: { count: 0 },
  states: {
    a: {
      entry: () => [{ kind: 'fx', tag: 'enterA' }],
      exit: () => [{ kind: 'fx', tag: 'exitA' }],
      on: {
        GO: { target: 'b', assign: (c) => ({ count: c.count + 1 }), effects: () => [{ kind: 'fx', tag: 'go' }] },
        INC: { assign: (c) => ({ count: c.count + 10 }) },  // self-transition (no target)
      },
    },
    b: {
      entry: () => [{ kind: 'fx', tag: 'enterB' }],
      on: {},
    },
  },
}

describe('fsm transition()', () => {
  it('未命中事件时原样返回、无 effects', () => {
    const r = transition(def, { state: 'a', context: { count: 0 } }, { type: 'NOPE' })
    expect(r.snapshot.state).toBe('a')
    expect(r.effects).toEqual([])
  })

  it('状态切换时按 exit -> transition.effects -> entry 顺序产出', () => {
    const r = transition(def, { state: 'a', context: { count: 0 } }, { type: 'GO' })
    expect(r.snapshot).toEqual({ state: 'b', context: { count: 1 } })
    expect(r.effects.map(e => e.tag)).toEqual(['exitA', 'go', 'enterB'])
  })

  it('自转换只应用 assign，不触发 entry/exit', () => {
    const r = transition(def, { state: 'a', context: { count: 0 } }, { type: 'INC' })
    expect(r.snapshot).toEqual({ state: 'a', context: { count: 10 } })
    expect(r.effects).toEqual([])
  })

  it('守卫为 false 时跳过该候选转换', () => {
    const guarded: MachineDef<S, C, E, F> = {
      initial: 'a', context: { count: 0 },
      states: {
        a: { on: { GO: [{ guard: () => false, target: 'b' }, { target: 'a', effects: () => [{ kind: 'fx', tag: 'fallback' }] }] } },
        b: { on: {} },
      },
    }
    const r = transition(guarded, { state: 'a', context: { count: 0 } }, { type: 'GO' })
    expect(r.snapshot.state).toBe('a')
    expect(r.effects.map(e => e.tag)).toEqual(['fallback'])
  })
})

describe('MachineRunner', () => {
  it('构造时执行初始状态的 entry effects', () => {
    const log: string[] = []
    const runner = new MachineRunner(def, (f) => log.push(f.tag))
    expect(log).toEqual(['enterA'])
    expect(runner.state).toBe('a')
  })

  it('send 后推进快照并执行 effects', () => {
    const log: string[] = []
    const runner = new MachineRunner(def, (f) => log.push(f.tag))
    log.length = 0
    runner.send({ type: 'GO' })
    expect(runner.state).toBe('b')
    expect(runner.context.count).toBe(1)
    expect(log).toEqual(['exitA', 'go', 'enterB'])
  })
})
