class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = new Float32Array(960)
    this._offset = 0
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) return true

    for (let i = 0; i < input.length; i++) {
      this._buffer[this._offset++] = input[i]
      if (this._offset === 960) {
        this.port.postMessage({ pcm: this._buffer.slice() })
        this._offset = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
