// 轻量自研有限状态机内核的类型定义（零依赖）。
//
// 设计要点：状态机是纯函数 `(state, context, event) -> { state, context, effects[] }`。
// Effect 是“数据描述符”而非回调，由 application 层注入了端口的解释器执行——
// 这保证机器本身纯净、可直接断言产出的 effects，与 React / Zustand / DOM 完全解耦。

export interface Transition<S extends string, C, E extends { type: string }, F> {
  /** 目标状态；省略表示自转换（停留在当前状态，不触发 entry/exit）。 */
  target?: S
  /** 守卫：返回 false 则跳过此转换，尝试同一事件的下一个候选转换。 */
  guard?: (ctx: C, ev: E) => boolean
  /** 纯上下文更新（浅合并）。 */
  assign?: (ctx: C, ev: E) => Partial<C>
  /** 声明式 effect 描述符。 */
  effects?: (ctx: C, ev: E) => F[]
}

export interface StateNode<S extends string, C, E extends { type: string }, F> {
  on?: Partial<Record<E['type'], Transition<S, C, E, F> | Transition<S, C, E, F>[]>>
  entry?: (ctx: C) => F[]
  exit?: (ctx: C) => F[]
}

export interface MachineDef<S extends string, C, E extends { type: string }, F> {
  initial: S
  context: C
  states: Record<S, StateNode<S, C, E, F>>
}

export interface MachineSnapshot<S extends string, C> {
  state: S
  context: C
}

export interface StepResult<S extends string, C, F> {
  snapshot: MachineSnapshot<S, C>
  effects: F[]
}
