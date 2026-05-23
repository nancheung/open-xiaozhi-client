import OpusScript from 'opusscript'

type ValidSamplingRate = 8000 | 12000 | 16000 | 24000 | 48000

let decoder: InstanceType<typeof OpusScript> | null = null
let _sampleRate: ValidSamplingRate = 24000

/** 初始化解码器，必须在收到服务器 hello 后调用 */
export function initDecoder(sampleRate: number) {
  decoder?.delete()
  _sampleRate = sampleRate as ValidSamplingRate
  // WASM 版本在浏览器主线程中同步 XHR 被禁用，使用 NASM (asm.js) 版本，代码内联无需网络请求
  decoder = new OpusScript(_sampleRate, 1, OpusScript.Application.AUDIO, { wasm: false })
}

/** Opus Uint8Array → Float32 PCM */
export function decodeOpusToFloat32(opusData: Uint8Array): Float32Array {
  if (!decoder) initDecoder(_sampleRate)
  // Buffer 是 Node.js API，浏览器不可用；opusscript 运行时接受 Uint8Array（Buffer 的父类）
  const int16Buf = decoder!.decode(opusData as unknown as Buffer)
  const int16 = new Int16Array(int16Buf.buffer, int16Buf.byteOffset, int16Buf.byteLength / 2)
  return int16ToFloat32(int16)
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF)
  }
  return float32
}

export function disposeDecoder() {
  decoder?.delete()
  decoder = null
}

/** 用于回放：用临时解码器将多个 opus 帧拼接解码为 Float32 PCM */
export function decodeChunksForPlayback(chunks: Uint8Array[], sampleRate: number): Float32Array {
  const tempDecoder = new OpusScript(sampleRate as ValidSamplingRate, 1, OpusScript.Application.AUDIO, { wasm: false })
  try {
    const pcmArrays: Float32Array[] = []
    let totalLength = 0
    for (const chunk of chunks) {
      const int16Buf = tempDecoder.decode(chunk as unknown as Buffer)
      const int16 = new Int16Array(int16Buf.buffer, int16Buf.byteOffset, int16Buf.byteLength / 2)
      const float32 = int16ToFloat32(int16)
      pcmArrays.push(float32)
      totalLength += float32.length
    }
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const arr of pcmArrays) {
      result.set(arr, offset)
      offset += arr.length
    }
    return result
  } finally {
    tempDecoder.delete()
  }
}
