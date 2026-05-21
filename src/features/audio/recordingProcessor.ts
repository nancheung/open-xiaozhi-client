// AudioWorklet Processor 代码以字符串形式内联，通过 Blob URL 加载，
// 避免 Vite 的模块系统干扰，同时兼容 dev / preview / build 三种模式。
// Worklet 线程不能 import 任何模块，因此编码逻辑在主线程完成。
const PROCESSOR_CODE = `
class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._frameSize = 960 // 60ms @ 16kHz
    this._buf = new Float32Array(this._frameSize)
    this._pos = 0
  }
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      this._buf[this._pos++] = ch[i]
      if (this._pos === this._frameSize) {
        this.port.postMessage({ type: 'pcm', data: this._buf.slice() })
        this._pos = 0
      }
    }
    return true
  }
}
registerProcessor('recording-processor', RecordingProcessor)
`

export function createRecordingProcessorUrl(): string {
  const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}
