import type { ClockPort } from '../../core/ports/ClockPort'

export class BrowserClock implements ClockPort {
  now(): number { return Date.now() }
  setTimeout(fn: () => void, ms: number): number { return setTimeout(fn, ms) as unknown as number }
  clearTimeout(id: number): void { clearTimeout(id) }
  setInterval(fn: () => void, ms: number): number { return setInterval(fn, ms) as unknown as number }
  clearInterval(id: number): void { clearInterval(id) }
}
