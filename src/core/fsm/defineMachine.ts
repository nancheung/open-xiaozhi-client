import type {
  MachineDef, MachineSnapshot, StepResult, Transition,
} from './types'

function selectTransition<S extends string, C, E extends { type: string }, F>(
  handler: Transition<S, C, E, F> | Transition<S, C, E, F>[] | undefined,
  ctx: C,
  ev: E,
): Transition<S, C, E, F> | undefined {
  if (!handler) return undefined
  const candidates = Array.isArray(handler) ? handler : [handler]
  for (const tr of candidates) {
    if (!tr.guard || tr.guard(ctx, ev)) return tr
  }
  return undefined
}

/**
 * 纯转换函数：给定机器定义、当前快照与事件，返回新快照与待执行的 effects。
 * 未命中任何转换时原样返回、effects 为空（忽略未处理事件）。
 *
 * Effect 顺序：状态发生切换时为 `exit(当前) -> transition.effects -> entry(目标)`；
 * 自转换仅产出 `transition.effects`。assign 永远应用。
 */
export function transition<S extends string, C, E extends { type: string }, F>(
  def: MachineDef<S, C, E, F>,
  snap: MachineSnapshot<S, C>,
  ev: E,
): StepResult<S, C, F> {
  const node = def.states[snap.state]
  const tr = selectTransition<S, C, E, F>(node.on?.[ev.type as E['type']], snap.context, ev)
  if (!tr) return { snapshot: snap, effects: [] }

  const target = (tr.target ?? snap.state) as S
  const nextCtx = tr.assign ? { ...snap.context, ...tr.assign(snap.context, ev) } : snap.context
  const changing = tr.target !== undefined && tr.target !== snap.state

  const effects: F[] = []
  if (changing && node.exit) effects.push(...node.exit(snap.context))
  if (tr.effects) effects.push(...tr.effects(snap.context, ev))
  if (changing && def.states[target].entry) effects.push(...def.states[target].entry(nextCtx))

  return { snapshot: { state: target, context: nextCtx }, effects }
}

/**
 * 状态机解释器：持有可变快照，`send(event)` 后把产出的 effects 逐个交给注入的执行器。
 * 这是唯一触碰副作用的地方；机器定义本身保持纯净。
 */
export class MachineRunner<S extends string, C, E extends { type: string }, F> {
  private snap: MachineSnapshot<S, C>

  constructor(
    private readonly def: MachineDef<S, C, E, F>,
    private readonly exec: (effect: F, snapshot: MachineSnapshot<S, C>) => void,
  ) {
    this.snap = { state: def.initial, context: def.context }
    const entry = def.states[def.initial].entry?.(def.context) ?? []
    for (const f of entry) this.exec(f, this.snap)
  }

  send(ev: E): void {
    const { snapshot, effects } = transition(this.def, this.snap, ev)
    this.snap = snapshot
    for (const f of effects) this.exec(f, this.snap)
  }

  get snapshot(): MachineSnapshot<S, C> {
    return this.snap
  }

  get state(): S {
    return this.snap.state
  }

  get context(): C {
    return this.snap.context
  }
}
