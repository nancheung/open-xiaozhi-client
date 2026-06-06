// 极简类型化发布/订阅事件总线（零依赖）。
// 用于把领域事件从 application 层广播给只读视图模型投影与其他订阅者（如音频播放适配器）。

export type Listener<T> = (event: T) => void

export class EventBus<T extends { type: string }> {
  private readonly subs = new Set<Listener<T>>()

  emit(event: T): void {
    // 复制一份再遍历，允许订阅者在回调中取消订阅而不影响本次派发
    for (const listener of [...this.subs]) listener(event)
  }

  subscribe(listener: Listener<T>): () => void {
    this.subs.add(listener)
    return () => { this.subs.delete(listener) }
  }

  clear(): void {
    this.subs.clear()
  }
}
