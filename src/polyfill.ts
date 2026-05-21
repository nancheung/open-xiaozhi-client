// opusscript 是 Node.js 库，内部在 encode/decode 时调用 Buffer.from()。
// 此模块在应用启动时将 Buffer polyfill 注入全局，使 opusscript 在浏览器中正常工作。
import { Buffer } from 'buffer'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).Buffer = Buffer
