import OpusScript from 'opusscript'

type ValidSamplingRate = 8000 | 12000 | 16000 | 24000 | 48000

let encoder: InstanceType<typeof OpusScript> | null = null

function getEncoder() {
  if (!encoder) {
    encoder = new OpusScript(16000 as ValidSamplingRate, 1, OpusScript.Application.VOIP)
  }
  return encoder
}

/** Float32 PCM（960 样本，16kHz）→ Opus Uint8Array */
export function encodeFloat32ToOpus(float32Pcm: Float32Array): Uint8Array {
  const int16 = floatToInt16(float32Pcm)
  const buf = Buffer.from(int16.buffer)
  const encoded = getEncoder().encode(buf, 960)
  return new Uint8Array(encoded)
}

function floatToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16
}

export function disposeEncoder() {
  encoder?.delete()
  encoder = null
}
