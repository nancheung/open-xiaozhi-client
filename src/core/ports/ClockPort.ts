// 时钟端口：抽象 now() 与定时器，便于在测试中用假时钟驱动握手超时/心跳。

export interface ClockPort {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  setInterval(fn: () => void, ms: number): number
  clearInterval(id: number): void
}
